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
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

#include "core/players.h"
#include "core/flipper_uart.h"
#include "core/wifi_portal.h"

// ---------------------------------------------------------------------------
// User-configurable settings — edit these to your taste, then re-flash.
// ---------------------------------------------------------------------------

// Wi-Fi network name shown on phones.
static const char* AP_SSID = "Flipper-Quiz";

// Optional Wi-Fi password (>= 8 chars). Set to NULL for an OPEN network.
// Example:  static const char* AP_PASS = "monquiz2025";
static const char* AP_PASS = NULL;

// Captive-portal mode:
//   true  = phones auto-open the game page (convenient), but show a
//           "no internet" warning and Android may auto-disconnect.
//   false = STEALTH. We answer connectivity probes as if internet worked, so
//           no warning and no auto-disconnect. Players type
//           http://192.168.4.1/ themselves (or scan a QR code you display).
#define CAPTIVE_PORTAL_ENABLED  true

// ---------------------------------------------------------------------------
// Internal configuration (no need to edit below for normal use)
// ---------------------------------------------------------------------------
// Networking (SoftAP, DNS catch-all) lives in core/wifi_portal.{h,cpp}.
// Flipper UART pinout + transport lives in core/flipper_uart.{h,cpp}.

#define QUESTION_TIME_MS   20000UL

// Admin panel credentials (HTTP Basic Auth). NOTE: plaintext over an open
// Wi-Fi network - a convenience gate, not real security.
#define ADMIN_USER "admin"
#define ADMIN_PASS "adminadmin"

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

// players[] now lives in core/players.cpp (see core/players.h).
static GameState gameState        = LOBBY;
static int       currentQuestion  = -1;
static uint32_t  questionStartMs  = 0;

AsyncWebServer  server(80);
AsyncWebSocket  ws("/ws");

// Serializes every access to the game state, which is touched both by the loop
// task (UART / question timeout) and by the AsyncTCP task (WebSocket and HTTP
// admin callbacks). Held only at the outermost entry points below; the internal
// game-flow functions assume it is already taken.
static SemaphoreHandle_t gameMutex;
#define GAME_LOCK()   xSemaphoreTake(gameMutex, portMAX_DELAY)
#define GAME_UNLOCK() xSemaphoreGive(gameMutex)

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
  .notice{background:#2d2105;color:#ffd56b;border-left:4px solid #ffb000;padding:12px 14px;border-radius:10px;font-size:0.92rem;line-height:1.45;margin-bottom:18px}
  .notice b{color:#fff}
  .notice .lang{display:block;margin-top:6px}
</style></head><body>
<h1>Flipper-Quiz</h1><div class="sub" id="status">Connexion...</div>

<div class="screen on" id="s-join">
  <div class="notice">
    &#9888;&#65039; <b>Android</b> peut afficher "Pas d'acces Internet" / "No internet".
    <span class="lang">&#127467;&#127479; Choisis <b>"Rester connecte"</b> ou <b>"Utiliser ce reseau quand meme"</b>.</span>
    <span class="lang">&#127468;&#127463; Tap <b>"Stay connected"</b> or <b>"Use this network as-is"</b>.</span>
  </div>
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

<div class="center muted" style="margin-top:12px"><a href="/admin" style="color:#778">Admin</a></div>

<script>
var ws, joined=false, myName="", answered=false, myChoice=-1, answeredCorrect=false;
var screens={join:"s-join",wait:"s-wait",question:"s-question",reveal:"s-reveal",end:"s-end"};
function show(name){for(var k in screens){document.getElementById(screens[k]).classList.toggle("on",k===name);}}
function setStatus(t){document.getElementById("status").textContent=t;}

function connect(){
  ws=new WebSocket("ws://"+location.host+"/ws");
  ws.onopen=function(){if(myName){ws.send(JSON.stringify({type:"join",name:myName}));setStatus("Connecte - "+myName);}else setStatus("Choisis ton pseudo");};
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
// Embedded admin control panel (served behind HTTP Basic Auth)
// ---------------------------------------------------------------------------
static const char ADMIN_HTML[] PROGMEM = R"HTML(<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quiz - Admin</title>
<style>
  *{box-sizing:border-box;font-family:system-ui,sans-serif}
  body{background:#0f1020;color:#fff;margin:0;padding:20px;text-align:center}
  h1{font-size:1.4rem;margin:8px 0 16px}
  .card{background:#1b1d35;border-radius:12px;padding:16px;margin:0 auto 16px;max-width:420px}
  .row{display:flex;justify-content:space-between;padding:6px 2px;color:#cdd}
  .row b{color:#fff}
  button{width:100%;max-width:420px;padding:18px;font-size:1.2rem;font-weight:700;border:none;border-radius:12px;color:#fff;margin:8px auto;display:block;cursor:pointer}
  .next{background:#26890c}.reset{background:#e6394a}
  a{color:#9aa}
</style></head><body>
<h1>Quiz &mdash; Maitre du jeu</h1>
<div class="card">
  <div class="row"><span>Etat</span><b id="state">...</b></div>
  <div class="row"><span>Joueurs</span><b id="players">0</b></div>
  <div class="row"><span>Question</span><b id="q">-</b></div>
</div>
<button class="next" onclick="act('next')">Demarrer / Question suivante</button>
<button class="reset" onclick="act('reset')">Recommencer (Reset)</button>
<p><a href="/">Retour a la page joueur</a></p>
<script>
function act(a){fetch('/admin/'+a).then(refresh);}
function refresh(){fetch('/admin/state').then(function(r){return r.json();}).then(function(s){
  document.getElementById('state').textContent=s.state;
  document.getElementById('players').textContent=s.players;
  document.getElementById('q').textContent=s.qt?(s.qi+'/'+s.qt):'-';
}).catch(function(){});}
setInterval(refresh,1500);refresh();
</script></body></html>)HTML";

// ---------------------------------------------------------------------------
// Quiz-specific helpers (still here pending C5 extraction into a game module)
// ---------------------------------------------------------------------------
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
    doc["hostId"]  = host_id;
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
// Game flow (all called with gameMutex already held)
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
// Transport is in core/flipper_uart.{h,cpp}; the bindings below are the
// quiz-app-specific semantics on top of it. They will move into the quiz
// game module in C5.
// ---------------------------------------------------------------------------
static void sendToFlipper() {
    flipper_uart_printf("PLAYERS:%d\n", activeCount());
    flipper_uart_printf("STATE:%s\n", stateName());
    Player* h = host_get();
    flipper_uart_printf("HOST:%s\n", h ? h->name : "");
    if (gameState == QUESTION || gameState == REVEAL)
        flipper_uart_printf("Q:%d/%d\n", currentQuestion + 1, QUESTION_COUNT);
}

static void onFlipperCommand(const char* cmd) {
    GAME_LOCK();
    if (strcmp(cmd, "NEXT") == 0 || strcmp(cmd, "START") == 0) advance();
    else if (strcmp(cmd, "RESET") == 0)                        resetGame();
    GAME_UNLOCK();
}

// ---------------------------------------------------------------------------
// WebSocket handling
// ---------------------------------------------------------------------------
static void handleMessage(AsyncWebSocketClient* client, uint8_t* data, size_t len) {
    JsonDocument doc;
    if (deserializeJson(doc, data, len)) return;
    const char* type = doc["type"];
    if (!type) return;

    GAME_LOCK();
    if (strcmp(type, "join") == 0) {
        const char* name = doc["name"] | "Joueur";
        Player* p = findReconnectSlot(name);   // reconnect: reclaim slot + keep score
        if (!p) p = findPlayer(client->id());
        if (!p) p = addPlayer(client->id());
        if (p) {
            p->active   = true;
            p->clientId = client->id();
            strncpy(p->name, name, MAX_NAME_LEN);
            p->name[MAX_NAME_LEN] = '\0';

            host_recompute();

            JsonDocument ack; ack["type"] = "joined";
            ack["host"] = host_is(client->id());
            String out; serializeJson(ack, out);
            client->text(out);

            broadcastLobby();
            sendToFlipper();
            if (gameState == QUESTION) client->text(questionJson());  // late joiner: live question
        }
    } else if (strcmp(type, "answer") == 0) {
        Player* p = findPlayer(client->id());
        int choice = doc["choice"] | -1;
        if (gameState == QUESTION && p && !p->answered && choice >= 0 && choice <= 3) {
            p->answered = true;
            p->answer   = (uint8_t)choice;
            p->answerMs = millis() - questionStartMs;

            JsonDocument ack; ack["type"] = "ack";
            String out; serializeJson(ack, out);
            client->text(out);

            if (allAnswered()) reveal();
        }
    }
    GAME_UNLOCK();
}

static void onWsEvent(AsyncWebSocket*, AsyncWebSocketClient* client,
                      AwsEventType type, void* arg, uint8_t* data, size_t len) {
    if (type == WS_EVT_DISCONNECT) {
        GAME_LOCK();
        removePlayer(client->id());
        host_recompute();
        broadcastLobby();
        sendToFlipper();
        GAME_UNLOCK();
    } else if (type == WS_EVT_DATA) {
        AwsFrameInfo* info = (AwsFrameInfo*)arg;
        if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT)
            handleMessage(client, data, len);
    }
}

// ---------------------------------------------------------------------------
// HTTP / captive portal
// ---------------------------------------------------------------------------
static bool adminAuth(AsyncWebServerRequest* req) {
    if (!req->authenticate(ADMIN_USER, ADMIN_PASS)) {
        req->requestAuthentication();
        return false;
    }
    return true;
}

static void setupServer() {
    ws.onEvent(onWsEvent);
    server.addHandler(&ws);

    server.on("/", HTTP_GET, [](AsyncWebServerRequest* req) {
        req->send(200, "text/html", INDEX_HTML);
    });

    // Admin control panel (password-protected via HTTP Basic Auth), reachable
    // from the "Admin" link on the player page. Works without the Flipper.
    server.on("/admin", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        req->send(200, "text/html", ADMIN_HTML);
    });
    server.on("/admin/state", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        GAME_LOCK();
        const char* st = stateName();
        int  pc  = activeCount();
        bool inq = (gameState == QUESTION || gameState == REVEAL);
        int  qi  = currentQuestion + 1;
        GAME_UNLOCK();
        JsonDocument doc;
        doc["state"]   = st;
        doc["players"] = pc;
        if (inq) { doc["qi"] = qi; doc["qt"] = QUESTION_COUNT; }
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });
    server.on("/admin/start", HTTP_GET, [](AsyncWebServerRequest* req) { if (!adminAuth(req)) return; GAME_LOCK(); advance();   GAME_UNLOCK(); req->send(200, "text/plain", "ok"); });
    server.on("/admin/next",  HTTP_GET, [](AsyncWebServerRequest* req) { if (!adminAuth(req)) return; GAME_LOCK(); advance();   GAME_UNLOCK(); req->send(200, "text/plain", "ok"); });
    server.on("/admin/reset", HTTP_GET, [](AsyncWebServerRequest* req) { if (!adminAuth(req)) return; GAME_LOCK(); resetGame(); GAME_UNLOCK(); req->send(200, "text/plain", "ok"); });

    // Connectivity-probe handling: depending on CAPTIVE_PORTAL_ENABLED above,
    // we either force the captive-portal popup (aggressive) or answer probes
    // as if internet worked (stealth — no "no internet" warning, no auto-
    // disconnect on Android, but no auto-popup either).
    server.onNotFound([](AsyncWebServerRequest* req) {
#if CAPTIVE_PORTAL_ENABLED
        req->redirect("http://192.168.4.1/");
#else
        String url = req->url();
        // Android (Chrome / system): expects HTTP 204 No Content.
        if (url.endsWith("/generate_204") || url == "/gen_204") {
            req->send(204);
        // Windows: expects "Microsoft NCSI" or "Microsoft Connect Test".
        } else if (url.indexOf("ncsi.txt") >= 0) {
            req->send(200, "text/plain", "Microsoft NCSI");
        } else if (url.indexOf("connecttest.txt") >= 0) {
            req->send(200, "text/plain", "Microsoft Connect Test");
        // iOS / macOS: expects an HTML page containing the word "Success".
        } else if (url.indexOf("hotspot-detect") >= 0 || url.indexOf("success.html") >= 0
                || url.indexOf("library/test") >= 0) {
            req->send(200, "text/html",
                "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>");
        } else {
            // Any other unknown URL — still serve the game page so a user typing
            // anything in the address bar lands on the quiz.
            req->send(200, "text/html", INDEX_HTML);
        }
#endif
    });

    server.begin();
}

// ---------------------------------------------------------------------------
void setup() {
    Serial.begin(115200);
    gameMutex = xSemaphoreCreateMutex();

    flipper_uart_begin();
    flipper_uart_set_command_handler(onFlipperCommand);

    wifi_portal_begin(AP_SSID, AP_PASS);

    setupServer();
}

void loop() {
    wifi_portal_poll();
    ws.cleanupClients();
    flipper_uart_poll();

    GAME_LOCK();
    if (gameState == QUESTION && millis() - questionStartMs > QUESTION_TIME_MS)
        reveal();
    GAME_UNLOCK();
}
