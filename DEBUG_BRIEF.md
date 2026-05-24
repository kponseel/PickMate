# DEBUG BRIEF — Flipper-Quiz (ESP32-S2 + Flipper Zero)

> Document auto-suffisant à coller dans une IA de debug. Il contient tout le
> contexte, les protocoles, et le CODE SOURCE COMPLET des deux programmes.

## Objectif du projet
Quiz multijoueur **local et hors-ligne**. La Wi-Fi Developer Board (ESP32-S2) du
Flipper crée un point d'accès Wi-Fi ouvert "Flipper-Quiz", sert une page web aux
smartphones (portail captif + WebSocket) et gère toute la logique du jeu. Le
Flipper Zero sert de pupitre au maître du jeu et dialogue avec l'ESP32 en UART.

## ⚠️ SYMPTÔME OBSERVÉ (À REMPLIR avant de demander de l'aide)
- Ce qui ne marche pas, précisément : .........................................
- Message(s) d'erreur exact(s) : ..............................................
- Étape qui échoue (entoure) : build ESP32 / upload ESP32 / `ufbt` build /
  app Flipper plante / app Flipper figée sur "Joueurs: 0" / la page ne s'ouvre
  pas sur le téléphone / pas de port COM / autre : ............................
- Ce qui marche déjà : ........................................................

## Matériel & versions
- Flipper Zero, firmware **OFW 1.4.3** (build 5 déc 2025), radio 1.20.0 LITE.
- **Wi-Fi Developer Board officielle (ESP32-S2)**.
- PC **Windows 11**, Flipper vu sur **COM3**.
- Toolchains : **PlatformIO** (Arduino) pour l'ESP32, **ufbt** pour l'app Flipper.

## Architecture
```
 [Téléphones]            [ESP32-S2 / Wi-Fi board]          [Flipper Zero]
      | Wi-Fi "Flipper-Quiz" + page web + WebSocket |            |
      +--------------------------------------------+            |
                                |  UART 115200 8N1 (texte, \n)  |
                                +-------------------------------+
```
- ESP32 = cerveau (AP Wi-Fi, portail captif, serveur web/WS, état du jeu, scores).
- Téléphones = manettes (page HTML servie par l'ESP32, WebSocket temps réel).
- Flipper = pupitre (affiche l'état reçu en UART, envoie NEXT/RESET en UART).
- Flipper et ESP32 sont DEUX programmes indépendants reliés par un câble série.

## Protocole UART (Flipper <-> ESP32) — 115200 bauds, 8N1, lignes ASCII '\n'
ESP32 -> Flipper :
- `PLAYERS:<n>`  (nb de joueurs connectés)
- `STATE:<s>`    (lobby | question | reveal | finished)
- `Q:<i>/<n>`    (question courante / total)
Flipper -> ESP32 :
- `START` ou `NEXT`  -> advance() (démarrer / suivant / révéler)
- `RESET`            -> recommence

## Protocole WebSocket (téléphone <-> ESP32) — JSON sur ws://192.168.4.1/ws
Client -> serveur :
- {"type":"join","name":"Bob"}
- {"type":"answer","choice":0..3}
Serveur -> client :
- {"type":"joined"} / {"type":"lobby","players":N}
- {"type":"question","index":i,"total":n,"q":"...","options":[...],"time":20}
- {"type":"ack"}
- {"type":"reveal","correct":i,"scores":[{"name":"...","score":N},...]}
- {"type":"finished","scores":[...]}

## Hypothèses & points de panne probables (ordre de priorité)
1. **BROCHES UART CÔTÉ ESP32 = SUSPECT N°1.** Le firmware utilise actuellement
   UART1 sur **RX=GPIO18 / TX=GPIO17** (valeurs PLACEHOLDER). Or la Wi-Fi board
   officielle relie le plus souvent l'UART du Flipper (broches 13=TX/14=RX) à
   l'**UART0 de l'ESP32-S2 (GPIO43=TX0 / GPIO44=RX0)**. Si le Flipper reste figé
   sur "Joueurs: 0", c'est très probablement ça. -> Confirmer le câblage réel de
   la board et corriger `FLIPPER_UART_RX_PIN/TX_PIN` (ou passer sur UART0).
   Vérifier aussi le CROISEMENT TX<->RX.
2. **API série Flipper** : code en `furi_hal_serial_*` (API moderne, OK pour OFW
   1.4.3). Sur très vieux firmware ce serait `furi_hal_uart_*`.
3. **USART du Flipper déjà pris** (CLI/USB/autre app) -> `control_acquire` échoue
   et `furi_check` ferait crasher l'app. Fermer qFlipper.
4. **Libs ESP32 tirées par URL git** (ESPAsyncWebServer/AsyncTCP) -> réseau requis
   au 1er build PlatformIO.
5. **board PlatformIO** `esp32-s2-saola-1` générique -> peut nécessiter le board
   exact / réglages flash-size / USB.
6. **Portail captif** : selon l'OS la page peut ne pas pop -> ouvrir
   http://192.168.4.1 à la main.

## Méthode de test par couche (pour isoler la panne)
1. ESP32 SEUL (sans Flipper) : flasher, `pio device monitor` -> doit afficher
   "Flipper-Quiz AP ... up at 192.168.4.1". Connecter un téléphone, piloter via
   navigateur `http://192.168.4.1/admin/next`. Si le jeu tourne ainsi => tout le
   bloc ESP32/Wi-Fi/WS/UI est bon, et la panne est dans l'UART.
2. UART SEUL : à chaque advance, l'ESP32 doit émettre PLAYERS:/STATE:/Q: ;
   envoyer `NEXT\n` doit faire avancer la partie.
3. FLIPPER SEUL : ouvrir l'app Quiz Master ; si elle s'ouvre sans crash, GUI +
   acquisition USART OK. Si "Etat:" reste "..." quand l'ESP32 émet => point 1 des
   hypothèses (broches/câblage).

## Question à l'IA de debug
"Voici tout le contexte et le code source complet ci-dessous. Aide-moi à
identifier la cause du symptôme décrit plus haut. En particulier : confirme le
mapping UART correct entre l'ESP32-S2 de la Wi-Fi Developer Board OFFICIELLE du
Flipper et l'USART du Flipper (broches 13/14), et indique exactement quelles
lignes corriger dans `esp32-quiz/src/main.cpp` et/ou `apps/quiz_master/quiz_master.c`."

---

# CODE SOURCE COMPLET

## esp32-quiz/platformio.ini
```ini
; Flipper-Quiz - ESP32-S2 captive-portal quiz server (Wi-Fi Dev Board)
;
;   Build           : pio run
;   Flash over USB  : pio run -t upload
;   Serial monitor  : pio device monitor
;
; If your board is not a generic ESP32-S2 Saola, change `board` below.

[env:flipper-wifi-devboard]
platform = espressif32
board = esp32-s2-saola-1
framework = arduino
monitor_speed = 115200
build_flags =
    ; ESP32-S2 has native USB: keep Serial (debug) on USB-CDC so UART1 is free for the Flipper
    -D ARDUINO_USB_CDC_ON_BOOT=1
lib_deps =
    bblanchon/ArduinoJson @ ^7.0.4
    https://github.com/ESP32Async/ESPAsyncWebServer.git
    https://github.com/ESP32Async/AsyncTCP.git
```

## esp32-quiz/src/main.cpp
```cpp
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

// UART link to the Flipper Zero. These pins MUST match how the ESP32 is wired
// to the Flipper's GPIO header on your board; adjust if needed.
#define FLIPPER_UART_RX_PIN 18
#define FLIPPER_UART_TX_PIN 17
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
```

## apps/quiz_master/application.fam
```python
App(
    appid="quiz_master",
    name="Quiz Master",
    apptype=FlipperAppType.EXTERNAL,
    entry_point="quiz_master_app",
    stack_size=4 * 1024,
    fap_category="GPIO",
    fap_author="kponseel",
    fap_version="1.0",
    fap_description="Game master for the Flipper-Quiz ESP32 server (UART)",
)
```

## apps/quiz_master/quiz_master.c
```c
/*
 * Quiz Master - Flipper Zero companion app for the Flipper-Quiz ESP32 server.
 *
 * Talks to the ESP32 (Wi-Fi Dev Board) over UART. It displays the live game
 * state pushed by the ESP32 and lets the game master drive the round with the
 * Flipper's physical buttons:
 *   OK   -> "NEXT"  (start / reveal / next question)
 *   Down -> "RESET" (restart the game)
 *   Back -> quit
 *
 * Wiring: the Wi-Fi Dev Board uses the Flipper's USART (GPIO 13=TX, 14=RX).
 */

#include <furi.h>
#include <furi_hal_serial.h>
#include <furi_hal_serial_control.h>
#include <gui/gui.h>
#include <input/input.h>
#include <string.h>
#include <stdlib.h>

#define UART_BAUD       115200
#define RX_STREAM_SIZE  256
#define LINE_MAX        64

typedef struct {
    int  players;
    char state[16];
    char qinfo[16];
} QuizState;

typedef struct {
    Gui*                 gui;
    ViewPort*            view_port;
    FuriMessageQueue*    input_queue;
    FuriMutex*           mutex;
    FuriHalSerialHandle* serial;
    FuriThread*          worker;
    FuriStreamBuffer*    rx_stream;
    QuizState            quiz;
    volatile bool        running;
} QuizApp;

// --- UART ------------------------------------------------------------------
static void uart_rx_cb(FuriHalSerialHandle* handle, FuriHalSerialRxEvent event, void* context) {
    QuizApp* app = context;
    if(event == FuriHalSerialRxEventData) {
        uint8_t b = furi_hal_serial_async_rx(handle);
        furi_stream_buffer_send(app->rx_stream, &b, 1, 0);
    }
}

static void uart_send(QuizApp* app, const char* s) {
    furi_hal_serial_tx(app->serial, (const uint8_t*)s, strlen(s));
}

static void parse_line(QuizApp* app, const char* line) {
    furi_mutex_acquire(app->mutex, FuriWaitForever);
    if(strncmp(line, "PLAYERS:", 8) == 0) {
        app->quiz.players = atoi(line + 8);
    } else if(strncmp(line, "STATE:", 6) == 0) {
        strncpy(app->quiz.state, line + 6, sizeof(app->quiz.state) - 1);
        app->quiz.state[sizeof(app->quiz.state) - 1] = '\0';
    } else if(strncmp(line, "Q:", 2) == 0) {
        strncpy(app->quiz.qinfo, line + 2, sizeof(app->quiz.qinfo) - 1);
        app->quiz.qinfo[sizeof(app->quiz.qinfo) - 1] = '\0';
    }
    furi_mutex_release(app->mutex);
    view_port_update(app->view_port);
}

static int32_t uart_worker(void* context) {
    QuizApp* app = context;
    char line[LINE_MAX];
    size_t idx = 0;
    uint8_t b;
    while(app->running) {
        if(furi_stream_buffer_receive(app->rx_stream, &b, 1, 100) == 0) continue;
        if(b == '\n' || b == '\r') {
            line[idx] = '\0';
            if(idx > 0) parse_line(app, line);
            idx = 0;
        } else if(idx < LINE_MAX - 1) {
            line[idx++] = (char)b;
        }
    }
    return 0;
}

// --- GUI -------------------------------------------------------------------
static void draw_cb(Canvas* canvas, void* ctx) {
    QuizApp* app = ctx;
    furi_mutex_acquire(app->mutex, FuriWaitForever);
    QuizState q = app->quiz;
    furi_mutex_release(app->mutex);

    char buf[32];
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 2, 12, "Flipper-Quiz");

    canvas_set_font(canvas, FontSecondary);
    snprintf(buf, sizeof(buf), "Joueurs: %d", q.players);
    canvas_draw_str(canvas, 2, 26, buf);
    snprintf(buf, sizeof(buf), "Etat: %s", q.state[0] ? q.state : "...");
    canvas_draw_str(canvas, 2, 38, buf);
    if(q.qinfo[0]) {
        snprintf(buf, sizeof(buf), "Question: %s", q.qinfo);
        canvas_draw_str(canvas, 2, 50, buf);
    }
    canvas_draw_str(canvas, 2, 62, "OK:Suivant  Bas:Reset");
}

static void input_cb(InputEvent* input_event, void* ctx) {
    FuriMessageQueue* queue = ctx;
    furi_message_queue_put(queue, input_event, FuriWaitForever);
}

// --- App -------------------------------------------------------------------
int32_t quiz_master_app(void* p) {
    UNUSED(p);

    QuizApp* app = malloc(sizeof(QuizApp));
    memset(app, 0, sizeof(QuizApp));
    app->running     = true;
    app->mutex       = furi_mutex_alloc(FuriMutexTypeNormal);
    app->input_queue = furi_message_queue_alloc(8, sizeof(InputEvent));
    app->rx_stream   = furi_stream_buffer_alloc(RX_STREAM_SIZE, 1);
    strcpy(app->quiz.state, "...");

    app->view_port = view_port_alloc();
    view_port_draw_callback_set(app->view_port, draw_cb, app);
    view_port_input_callback_set(app->view_port, input_cb, app->input_queue);
    app->gui = furi_record_open(RECORD_GUI);
    gui_add_view_port(app->gui, app->view_port, GuiLayerFullscreen);

    app->serial = furi_hal_serial_control_acquire(FuriHalSerialIdUsart);
    furi_check(app->serial);
    furi_hal_serial_init(app->serial, UART_BAUD);
    furi_hal_serial_async_rx_start(app->serial, uart_rx_cb, app, false);

    app->worker = furi_thread_alloc_ex("QuizUartWorker", 2048, uart_worker, app);
    furi_thread_start(app->worker);

    InputEvent event;
    bool running = true;
    while(running) {
        if(furi_message_queue_get(app->input_queue, &event, FuriWaitForever) == FuriStatusOk) {
            if(event.type == InputTypePress) {
                if(event.key == InputKeyBack) {
                    running = false;
                } else if(event.key == InputKeyOk) {
                    uart_send(app, "NEXT\n");
                } else if(event.key == InputKeyDown) {
                    uart_send(app, "RESET\n");
                }
            }
        }
    }

    app->running = false;
    furi_thread_join(app->worker);
    furi_thread_free(app->worker);

    furi_hal_serial_async_rx_stop(app->serial);
    furi_hal_serial_deinit(app->serial);
    furi_hal_serial_control_release(app->serial);

    gui_remove_view_port(app->gui, app->view_port);
    furi_record_close(RECORD_GUI);
    view_port_free(app->view_port);

    furi_message_queue_free(app->input_queue);
    furi_stream_buffer_free(app->rx_stream);
    furi_mutex_free(app->mutex);
    free(app);
    return 0;
}
```
