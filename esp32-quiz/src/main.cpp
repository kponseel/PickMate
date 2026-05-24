/*
 * Flipper-Quiz - local, offline multiplayer quiz server for the ESP32-S2
 * Wi-Fi Developer Board.
 *
 * The ESP32 opens an open Wi-Fi access point ("Flipper-Quiz"), runs a captive
 * portal so phones auto-open the game UI, serves a single embedded HTML page,
 * and drives the game over WebSockets. The game master advances questions from
 * the Flipper Zero (UART) or from a browser (/admin/* endpoints).
 */

#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
static const char* AP_SSID = "Flipper-Quiz";
static const IPAddress AP_IP(192, 168, 4, 1);
static const IPAddress AP_GATEWAY(192, 168, 4, 1);
static const IPAddress AP_SUBNET(255, 255, 255, 0);
static const byte DNS_PORT = 53;

// UART link to the Flipper Zero. On the official Wi-Fi Dev Board the Flipper's
// USART (pin 13 TX / pin 14 RX) is wired to the ESP32-S2 UART0 pins; we route
// FlipperSerial (UART1) onto them via the GPIO matrix.
#define FLIPPER_UART_RX_PIN 44  // <- Flipper pin 13 (TX)
#define FLIPPER_UART_TX_PIN 43  // -> Flipper pin 14 (RX)
#define FLIPPER_UART_BAUD   115200

#define MAX_PLAYERS        16
#define MAX_NAME_LEN       16
#define QUESTION_TIME_MS   20000UL

// ---------------------------------------------------------------------------
// Quiz content - edit freely
// ---------------------------------------------------------------------------
struct Question {
    const char* text;
    const char* options[4];
    uint8_t     correct;  // 0..3
};

static const Question QUESTIONS[] = {
    {"Quelle est la capitale de la France ?", {"Lyon", "Paris", "Marseille", "Nice"}, 1},
    {"Combien font 7 x 8 ?", {"54", "56", "64", "48"}, 1},
    {"Quel gaz les plantes absorbent-elles ?", {"Oxygene", "Azote", "CO2", "Helium"}, 2},
    {"Quel est le plus grand ocean ?", {"Atlantique", "Indien", "Arctique", "Pacifique"}, 3},
    {"Combien de bits dans un octet ?", {"4", "8", "16", "32"}, 1},
};
static const int QUESTION_COUNT = sizeof(QUESTIONS) / sizeof(QUESTIONS[0]);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
enum GameState { LOBBY, QUESTION, REVEAL, FINISHED };

struct Player {
    bool     active;
    uint32_t clientId;
    char     name[MAX_NAME_LEN + 1];
    uint32_t score;
    bool     answered;
    uint8_t  answer;
    uint32_t answerMs;
};

static Player    players[MAX_PLAYERS];
static GameState gameState        = LOBBY;
static int       currentQuestion  = -1;
static uint32_t  questionStartMs  = 0;

DNSServer       dnsServer;
AsyncWebServer  server(80);
AsyncWebSocket  ws("/ws");
HardwareSerial  FlipperSerial(1);

// ---------------------------------------------------------------------------
// Embedded player UI (single page, vanilla JS, mobile-first)
// ---------------------------------------------------------------------------
static const char INDEX_HTML[] PROGMEM = R"HTML(<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Flipper-Quiz</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}
  html,body{height:100%}
  body{background:#0f1020;color:#fff;display:flex;flex-direction:column;min-height:100vh;padding:16px}
  h1{font-size:1.6rem;text-align:center;margin:8px 0 4px}
  .sub{text-align:center;color:#9aa;margin-bottom:24px}
  .screen{flex:1;display:none;flex-direction:column;justify-content:center;gap:16px}
  .screen.on{display:flex}
  input{padding:16px;font-size:1.2rem;border:none;border-radius:12px;width:100%}
  button{padding:18px;font-size:1.2rem;font-weight:700;border:none;border-radius:12px;color:#fff;cursor:pointer}
  .primary{background:#5b6cff}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1}
  .grid button{font-size:1.4rem;min-height:96px}
  .a{background:#e6394a}.b{background:#1368ce}.c{background:#d89e00}.d{background:#26890c}
  .q{font-size:1.4rem;text-align:center;margin-bottom:8px}
  .big{font-size:3rem;text-align:center}
  .center{text-align:center}
  .muted{color:#9aa}
  ol{padding-left:0;list-style:none}
  li{display:flex;justify-content:space-between;padding:10px 14px;background:#1b1d35;border-radius:10px;margin-bottom:8px}
  button:disabled{opacity:.4}
</style></head><body>
<h1>Flipper-Quiz</h1><div class="sub" id="status">Connexion...</div>

<div class="screen on" id="s-join">
  <input id="name" placeholder="Ton pseudo" maxlength="16" autocomplete="off">
  <button class="primary" id="joinBtn">Rejoindre</button>
</div>

<div class="screen" id="s-wait">
  <div class="big">&#9203;</div>
  <div class="center">En attente du maitre du jeu...</div>
  <div class="center muted" id="waitMsg"></div>
</div>

<div class="screen" id="s-question">
  <div class="q" id="qText"></div>
  <div class="grid">
    <button class="a" data-c="0" id="b0"></button>
    <button class="b" data-c="1" id="b1"></button>
    <button class="c" data-c="2" id="b2"></button>
    <button class="d" data-c="3" id="b3"></button>
  </div>
</div>

<div class="screen" id="s-reveal">
  <div class="big" id="revealMark"></div>
  <div class="center" id="revealMsg"></div>
  <div class="center muted">Score : <span id="myScore">0</span></div>
</div>

<div class="screen" id="s-end">
  <h1>Classement</h1>
  <ol id="board"></ol>
</div>

<script>
var ws, joined=false, myName="", answered=false, myChoice=-1, answeredCorrect=false;
var screens={join:"s-join",wait:"s-wait",question:"s-question",reveal:"s-reveal",end:"s-end"};
function show(name){for(var k in screens){document.getElementById(screens[k]).classList.toggle("on",k===name);}}
function setStatus(t){document.getElementById("status").textContent=t;}

function connect(){
  ws=new WebSocket("ws://"+location.host+"/ws");
  ws.onopen=function(){setStatus(joined?("Connecte - "+myName):"Choisis ton pseudo");};
  ws.onclose=function(){setStatus("Deconnecte, reconnexion...");setTimeout(connect,1500);};
  ws.onmessage=function(e){handle(JSON.parse(e.data));};
}

function handle(m){
  if(m.type==="joined"){joined=true;setStatus("Connecte - "+myName);show("wait");}
  else if(m.type==="lobby"){document.getElementById("waitMsg").textContent=m.players+" joueur(s) connecte(s)";if(joined)show("wait");}
  else if(m.type==="question"){
    answered=false;myChoice=-1;
    document.getElementById("qText").textContent="("+(m.index+1)+"/"+m.total+") "+m.q;
    for(var i=0;i<4;i++){var b=document.getElementById("b"+i);b.textContent=m.options[i];b.disabled=false;}
    setStatus("Reponds vite !");show("question");
  }
  else if(m.type==="ack"){setStatus("Reponse envoyee, attends les autres...");for(var i=0;i<4;i++)document.getElementById("b"+i).disabled=true;}
  else if(m.type==="reveal"){
    answeredCorrect=(answered && myChoice===m.correct);
    var me=findMe(m.scores);
    document.getElementById("myScore").textContent=me?me.score:0;
    document.getElementById("revealMark").innerHTML=(answeredCorrect?"&#9989;":"&#10067;");
    document.getElementById("revealMsg").textContent="Bonne reponse : "+["A","B","C","D"][m.correct];
    show("reveal");
  }
  else if(m.type==="finished"){renderBoard(m.scores);show("end");setStatus("Partie terminee");}
}

function findMe(scores){for(var i=0;i<scores.length;i++)if(scores[i].name===myName)return scores[i];return null;}
function renderBoard(scores){
  var ol=document.getElementById("board");ol.innerHTML="";
  scores.forEach(function(s,i){var li=document.createElement("li");
    li.innerHTML="<span>"+(i+1)+". "+escapeHtml(s.name)+"</span><b>"+s.score+"</b>";ol.appendChild(li);});
}
function escapeHtml(t){var d=document.createElement("div");d.textContent=t;return d.innerHTML;}

document.getElementById("joinBtn").onclick=function(){
  var n=document.getElementById("name").value.trim();
  if(!n)return;myName=n.substring(0,16);
  ws.send(JSON.stringify({type:"join",name:myName}));
};
for(var i=0;i<4;i++){(function(i){
  document.getElementById("b"+i).onclick=function(){
    if(answered)return;answered=true;myChoice=i;
    ws.send(JSON.stringify({type:"answer",choice:i}));
  };
})(i);}

connect();show("join");
</script></body></html>)HTML";

// ---------------------------------------------------------------------------
// Player helpers
// ---------------------------------------------------------------------------
static Player* findPlayer(uint32_t clientId) {
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].clientId == clientId) return &players[i];
    return nullptr;
}

static Player* addPlayer(uint32_t clientId) {
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (!players[i].active) {
            players[i] = Player{};
            players[i].active   = true;
            players[i].clientId = clientId;
            return &players[i];
        }
    }
    return nullptr;
}

static void removePlayer(uint32_t clientId) {
    Player* p = findPlayer(clientId);
    if (p) p->active = false;
}

static int activeCount() {
    int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) if (players[i].active && players[i].name[0]) n++;
    return n;
}

static bool allAnswered() {
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0] && !players[i].answered) return false;
    return activeCount() > 0;
}

static const char* stateName() {
    switch (gameState) {
        case LOBBY:    return "lobby";
        case QUESTION: return "question";
        case REVEAL:   return "reveal";
        case FINISHED: return "finished";
    }
    return "?";
}

// ---------------------------------------------------------------------------
// Outgoing messages
// ---------------------------------------------------------------------------
static void fillSortedScores(JsonArray arr) {
    int idx[MAX_PLAYERS], n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0]) idx[n++] = i;
    for (int i = 0; i < n - 1; i++)
        for (int j = i + 1; j < n; j++)
            if (players[idx[j]].score > players[idx[i]].score) {
                int t = idx[i]; idx[i] = idx[j]; idx[j] = t;
            }
    for (int i = 0; i < n; i++) {
        JsonObject o = arr.add<JsonObject>();
        o["name"]  = players[idx[i]].name;
        o["score"] = players[idx[i]].score;
    }
}

static void sendToFlipper();

static void broadcastLobby() {
    JsonDocument doc;
    doc["type"]    = "lobby";
    doc["players"] = activeCount();
    String out; serializeJson(doc, out);
    ws.textAll(out);
}

static String questionJson() {
    const Question& q = QUESTIONS[currentQuestion];
    JsonDocument doc;
    doc["type"]  = "question";
    doc["index"] = currentQuestion;
    doc["total"] = QUESTION_COUNT;
    doc["q"]     = q.text;
    doc["time"]  = (int)(QUESTION_TIME_MS / 1000);
    JsonArray opts = doc["options"].to<JsonArray>();
    for (int i = 0; i < 4; i++) opts.add(q.options[i]);
    String out; serializeJson(doc, out);
    return out;
}

static void broadcastQuestion() {
    ws.textAll(questionJson());
}

static void broadcastReveal() {
    JsonDocument doc;
    doc["type"]    = "reveal";
    doc["correct"] = QUESTIONS[currentQuestion].correct;
    fillSortedScores(doc["scores"].to<JsonArray>());
    String out; serializeJson(doc, out);
    ws.textAll(out);
}

static void broadcastFinished() {
    JsonDocument doc;
    doc["type"] = "finished";
    fillSortedScores(doc["scores"].to<JsonArray>());
    String out; serializeJson(doc, out);
    ws.textAll(out);
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
static void startQuestion(int idx) {
    currentQuestion = idx;
    gameState       = QUESTION;
    questionStartMs = millis();
    for (int i = 0; i < MAX_PLAYERS; i++) {
        players[i].answered = false;
        players[i].answer   = 0xFF;
    }
    broadcastQuestion();
    sendToFlipper();
}

static void reveal() {
    if (gameState != QUESTION) return;  // idempotent: timeout vs all-answered can both fire
    uint8_t correct = QUESTIONS[currentQuestion].correct;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        Player& p = players[i];
        if (p.active && p.name[0] && p.answered && p.answer == correct) {
            float frac = 1.0f - (float)p.answerMs / (float)QUESTION_TIME_MS;
            if (frac < 0) frac = 0;
            p.score += 500 + (uint32_t)(500.0f * frac);
        }
    }
    gameState = REVEAL;
    broadcastReveal();
    sendToFlipper();
}

static void finish() {
    gameState = FINISHED;
    broadcastFinished();
    sendToFlipper();
}

static void resetGame() {
    gameState       = LOBBY;
    currentQuestion = -1;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        players[i].score    = 0;
        players[i].answered = false;
    }
    broadcastLobby();
    sendToFlipper();
}

static void advance() {
    if (gameState == LOBBY) {
        if (QUESTION_COUNT > 0) startQuestion(0);
    } else if (gameState == QUESTION) {
        reveal();
    } else if (gameState == REVEAL) {
        if (currentQuestion + 1 < QUESTION_COUNT) startQuestion(currentQuestion + 1);
        else finish();
    } else { // FINISHED
        resetGame();
    }
}

// ---------------------------------------------------------------------------
// Flipper UART (newline-delimited line protocol)
// ---------------------------------------------------------------------------
static void sendToFlipper() {
    FlipperSerial.printf("PLAYERS:%d\n", activeCount());
    FlipperSerial.printf("STATE:%s\n", stateName());
    if (gameState == QUESTION || gameState == REVEAL)
        FlipperSerial.printf("Q:%d/%d\n", currentQuestion + 1, QUESTION_COUNT);
}

static void handleFlipperCommand(const String& cmd) {
    if (cmd == "NEXT" || cmd == "START") advance();
    else if (cmd == "RESET")             resetGame();
}

static void pollFlipper() {
    static String line;
    while (FlipperSerial.available()) {
        char c = (char)FlipperSerial.read();
        if (c == '\n' || c == '\r') {
            line.trim();
            if (line.length()) handleFlipperCommand(line);
            line = "";
        } else {
            line += c;
            if (line.length() > 32) line = "";
        }
    }
}

// ---------------------------------------------------------------------------
// WebSocket handling
// ---------------------------------------------------------------------------
static void handleMessage(AsyncWebSocketClient* client, uint8_t* data, size_t len) {
    JsonDocument doc;
    if (deserializeJson(doc, data, len)) return;
    const char* type = doc["type"];
    if (!type) return;

    if (strcmp(type, "join") == 0) {
        const char* name = doc["name"] | "Joueur";
        Player* p = findPlayer(client->id());
        if (!p) p = addPlayer(client->id());
        if (!p) return;
        strncpy(p->name, name, MAX_NAME_LEN);
        p->name[MAX_NAME_LEN] = '\0';

        JsonDocument ack; ack["type"] = "joined";
        String out; serializeJson(ack, out);
        client->text(out);

        broadcastLobby();
        sendToFlipper();
        if (gameState == QUESTION) {  // late joiner: show the live question (this client only)
            client->text(questionJson());
        }
    } else if (strcmp(type, "answer") == 0) {
        if (gameState != QUESTION) return;
        Player* p = findPlayer(client->id());
        if (!p || p->answered) return;
        int choice = doc["choice"] | -1;
        if (choice < 0 || choice > 3) return;
        p->answered = true;
        p->answer   = (uint8_t)choice;
        p->answerMs = millis() - questionStartMs;

        JsonDocument ack; ack["type"] = "ack";
        String out; serializeJson(ack, out);
        client->text(out);

        if (allAnswered()) reveal();
    }
}

static void onWsEvent(AsyncWebSocket*, AsyncWebSocketClient* client,
                      AwsEventType type, void* arg, uint8_t* data, size_t len) {
    if (type == WS_EVT_DISCONNECT) {
        removePlayer(client->id());
        broadcastLobby();
        sendToFlipper();
    } else if (type == WS_EVT_DATA) {
        AwsFrameInfo* info = (AwsFrameInfo*)arg;
        if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT)
            handleMessage(client, data, len);
    }
}

// ---------------------------------------------------------------------------
// HTTP / captive portal
// ---------------------------------------------------------------------------
static void setupServer() {
    ws.onEvent(onWsEvent);
    server.addHandler(&ws);

    server.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
        req->send(200, "text/html", INDEX_HTML);
    });

    // Browser-based game-master controls (works without the Flipper)
    server.on("/admin/start", HTTP_GET, [](AsyncWebServerRequest* req) { advance();   req->send(200, "text/plain", "ok"); });
    server.on("/admin/next",  HTTP_GET, [](AsyncWebServerRequest* req) { advance();   req->send(200, "text/plain", "ok"); });
    server.on("/admin/reset", HTTP_GET, [](AsyncWebServerRequest* req) { resetGame(); req->send(200, "text/plain", "ok"); });

    // Captive-portal: any other request (incl. OS connectivity-check URLs such
    // as /generate_204, /hotspot-detect.html, /ncsi.txt) is redirected to the
    // portal, which makes phones pop the game page automatically.
    server.onNotFound([](AsyncWebServerRequest* req) {
        req->redirect("http://192.168.4.1/");
    });

    server.begin();
}

// ---------------------------------------------------------------------------
void setup() {
    Serial.begin(115200);
    FlipperSerial.begin(FLIPPER_UART_BAUD, SERIAL_8N1, FLIPPER_UART_RX_PIN, FLIPPER_UART_TX_PIN);

    WiFi.mode(WIFI_AP);
    WiFi.softAPConfig(AP_IP, AP_GATEWAY, AP_SUBNET);
    WiFi.softAP(AP_SSID);  // open network

    dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
    dnsServer.start(DNS_PORT, "*", AP_IP);  // resolve every domain to the ESP32

    setupServer();

    Serial.printf("Flipper-Quiz AP '%s' up at %s\n", AP_SSID, WiFi.softAPIP().toString().c_str());
}

void loop() {
    dnsServer.processNextRequest();
    ws.cleanupClients();
    pollFlipper();

    if (gameState == QUESTION && millis() - questionStartMs > QUESTION_TIME_MS)
        reveal();
}
