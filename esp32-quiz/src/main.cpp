/*
 * GamesHub (was Flipper-Quiz) — local, offline multiplayer party-game server
 * for the ESP32-S2 Wi-Fi Developer Board clipped onto a Flipper Zero.
 *
 * The ESP32 opens an open Wi-Fi access point, runs a captive portal so phones
 * auto-open the hub UI, serves the embedded SPA, and synchronises the game
 * over WebSockets. The Flipper Zero displays the live state and the host's
 * physical buttons (OK = NEXT, Down = RESET) drive the game.
 *
 * The core (this file + core/) owns the lobby, players, WS hub, UART pump and
 * unified state push. Each game ships as a module under games/ that plugs
 * into the GAMES[] registry — see games/game_api.h.
 */

#include <Arduino.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>

#include "core/players.h"
#include "core/flipper_uart.h"
#include "core/wifi_portal.h"
#include "games/game_api.h"

// ---------------------------------------------------------------------------
// User-configurable settings — edit these to your taste, then re-flash.
// ---------------------------------------------------------------------------

// Wi-Fi network name shown on phones.
static const char* AP_SSID = "Flipper-Quiz";

// Optional Wi-Fi password (>= 8 chars). Set to NULL for an OPEN network.
static const char* AP_PASS = NULL;

// Captive-portal mode:
//   true  = phones auto-open the hub page (convenient), but Android may show
//           a "no internet" warning and might auto-disconnect.
//   false = STEALTH. We answer connectivity probes as if internet worked, so
//           no warning and no auto-disconnect. Players type
//           http://192.168.4.1/ themselves (or scan a QR code).
#define CAPTIVE_PORTAL_ENABLED  true

// Admin panel credentials (HTTP Basic Auth). NOTE: plaintext over an open
// Wi-Fi network — a convenience gate, not real security.
#define ADMIN_USER "admin"
#define ADMIN_PASS "adminadmin"

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
AsyncWebServer  server(80);
AsyncWebSocket  ws("/ws");

// Serialises every access to game/player state across the loop() and the
// AsyncTCP task. Held at the outermost entry points; internal helpers assume
// it is already taken.
static SemaphoreHandle_t gameMutex;
#define GAME_LOCK()   xSemaphoreTake(gameMutex, portMAX_DELAY)
#define GAME_UNLOCK() xSemaphoreGive(gameMutex)

static const char* phase_str(GamePhase p) {
    switch (p) {
        case GAME_PHASE_LOBBY:    return "lobby";
        case GAME_PHASE_PLAYING:  return "playing";
        case GAME_PHASE_REVEAL:   return "reveal";
        case GAME_PHASE_FINISHED: return "finished";
    }
    return "?";
}

// Forward declarations
static void broadcastState();
static void sendToFlipper();

// ---------------------------------------------------------------------------
// Embedded player SPA (single page, vanilla JS, mobile-first).
// Will migrate to LittleFS in C6.
// ---------------------------------------------------------------------------
static const char INDEX_HTML[] PROGMEM = R"HTML(<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>GamesHub</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}
  html,body{height:100%}
  body{background:#0f1020;color:#fff;display:flex;flex-direction:column;min-height:100vh;padding:16px}
  h1{font-size:1.6rem;text-align:center;margin:8px 0 4px}
  h2{font-size:1.2rem;text-align:center;margin:4px 0 12px;color:#cdd}
  .sub{text-align:center;color:#9aa;margin-bottom:18px;font-size:0.95rem}
  .screen{flex:1;display:none;flex-direction:column;justify-content:flex-start;gap:14px}
  .screen.on{display:flex}
  input{padding:16px;font-size:1.2rem;border:none;border-radius:12px;width:100%}
  button{padding:16px;font-size:1.15rem;font-weight:700;border:none;border-radius:12px;color:#fff;cursor:pointer}
  .primary{background:#5b6cff}
  .ghost{background:#1b1d35;color:#cdd}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;flex:1}
  .grid button{font-size:1.4rem;min-height:96px}
  .a{background:#e6394a}.b{background:#1368ce}.c{background:#d89e00}.d{background:#26890c}
  .q{font-size:1.3rem;text-align:center;margin-bottom:8px}
  .big{font-size:3rem;text-align:center}
  .center{text-align:center}
  .muted{color:#9aa;font-size:0.9rem}
  ol{padding-left:0;list-style:none}
  li{display:flex;justify-content:space-between;padding:10px 14px;background:#1b1d35;border-radius:10px;margin-bottom:8px}
  button:disabled{opacity:.4;cursor:not-allowed}
  .notice{background:#2d2105;color:#ffd56b;border-left:4px solid #ffb000;padding:12px 14px;border-radius:10px;font-size:0.9rem;line-height:1.45;margin-bottom:14px}
  .notice b{color:#fff} .notice .lang{display:block;margin-top:4px}
  .game-card{background:#1b1d35;border-radius:12px;padding:16px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:14px}
  .game-card.disabled{opacity:.5;cursor:not-allowed}
  .game-card .icon{font-size:2rem}
  .game-card .name{font-size:1.1rem;font-weight:700}
  .crown{color:#ffd56b}
  .playerlist{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0}
  .chip{background:#1b1d35;padding:6px 10px;border-radius:999px;font-size:0.9rem}
</style></head><body>
<h1>GamesHub</h1><div class="sub" id="status">Connexion...</div>

<!-- ============ JOIN ============ -->
<div class="screen on" id="s-join">
  <div class="notice">
    &#9888;&#65039; <b>Android</b> peut afficher "Pas d'acces Internet" / "No internet".
    <span class="lang">&#127467;&#127479; Choisis <b>"Rester connecte"</b> ou <b>"Utiliser ce reseau quand meme"</b>.</span>
    <span class="lang">&#127468;&#127463; Tap <b>"Stay connected"</b> or <b>"Use this network as-is"</b>.</span>
  </div>
  <input id="name" placeholder="Ton pseudo" maxlength="16" autocomplete="off">
  <button class="primary" id="joinBtn">Rejoindre</button>
</div>

<!-- ============ HUB (no game selected) ============ -->
<div class="screen" id="s-hub">
  <h2>Choisis un jeu</h2>
  <div id="gameList"></div>
  <div class="muted center" id="hubHint"></div>
  <div class="playerlist" id="hubPlayers"></div>
</div>

<!-- ============ LOBBY (game selected, waiting to start) ============ -->
<div class="screen" id="s-lobby">
  <div class="big" id="lobbyEmoji"></div>
  <h2 id="lobbyName"></h2>
  <div class="playerlist" id="lobbyPlayers"></div>
  <div class="center muted" id="lobbyHint">En attente du maitre du jeu...</div>
  <button class="primary" id="startBtn" style="display:none">Demarrer la partie</button>
  <button class="ghost" id="backToHubBtn" style="display:none">Retour au hub</button>
</div>

<!-- ============ QUESTION (quiz playing) ============ -->
<div class="screen" id="s-question">
  <div class="q" id="qText"></div>
  <div class="grid">
    <button class="a" data-c="0" id="b0"></button>
    <button class="b" data-c="1" id="b1"></button>
    <button class="c" data-c="2" id="b2"></button>
    <button class="d" data-c="3" id="b3"></button>
  </div>
  <div class="center muted" id="qStatus"></div>
</div>

<!-- ============ REVEAL ============ -->
<div class="screen" id="s-reveal">
  <div class="big" id="revealMark"></div>
  <div class="center" id="revealMsg"></div>
  <div class="center muted">Score : <span id="myScore">0</span></div>
  <button class="primary" id="nextBtn" style="display:none">Question suivante</button>
</div>

<!-- ============ END / SCOREBOARD ============ -->
<div class="screen" id="s-end">
  <h2>Classement</h2>
  <ol id="board"></ol>
  <button class="primary" id="resetBtn" style="display:none">Recommencer</button>
</div>

<div class="center muted" style="margin-top:12px"><a href="/admin" style="color:#778">Admin</a></div>

<script>
// Mirror of the server registry (server is source of truth for logic).
var GAMES = {
  quiz: { name:"Quiz", emoji:"🧠", desc:"Questions a choix multiples, score chrono." }
};

var ws, joined=false, myName="", state=null, lastAnswerChoice=-1;

function $(id){return document.getElementById(id);}
function setStatus(t){$("status").textContent=t;}

var screens=["s-join","s-hub","s-lobby","s-question","s-reveal","s-end"];
function show(id){screens.forEach(function(s){$(s).classList.toggle("on",s===id);});}

function findMe(){if(!state||!myName)return null;for(var i=0;i<state.players.length;i++)if(state.players[i].name===myName)return state.players[i];return null;}
function amHost(){var me=findMe();return !!(me&&me.host);}

function send(o){if(ws&&ws.readyState===1)ws.send(JSON.stringify(o));}

function connect(){
  ws=new WebSocket("ws://"+location.host+"/ws");
  ws.onopen=function(){
    if(myName){send({t:"join",name:myName});setStatus("Connecte - "+myName);}
    else setStatus("Choisis ton pseudo");
  };
  ws.onclose=function(){setStatus("Deconnecte, reconnexion...");setTimeout(connect,1500);};
  ws.onmessage=function(e){
    var m=JSON.parse(e.data);
    if(m.t==="state"){state=m;joined=joined||(findMe()!==null);render();}
  };
}

function render(){
  if(!state){show("s-join");return;}
  // Are we even joined?
  if(!findMe()){show("s-join");return;}

  // Currently playing a game?
  if(state.game){
    var game=GAMES[state.game];
    if(state.phase==="lobby"){renderLobby(game);}
    else if(state.game==="quiz"){renderQuiz();}
    return;
  }
  // No game selected -> hub
  renderHub();
}

function renderPlayerChips(target){
  var el=$(target);el.innerHTML="";
  state.players.forEach(function(p){
    var c=document.createElement("span");c.className="chip";
    c.innerHTML=(p.host?"<span class=crown>&#x1F451;</span> ":"")+escapeHtml(p.name);
    el.appendChild(c);
  });
}

function renderHub(){
  show("s-hub");
  var list=$("gameList");list.innerHTML="";
  var iAmHost=amHost();
  Object.keys(GAMES).forEach(function(id){
    var g=GAMES[id];
    var card=document.createElement("div");
    card.className="game-card"+(iAmHost?"":" disabled");
    card.innerHTML='<div class="icon">'+g.emoji+'</div><div><div class="name">'+escapeHtml(g.name)+'</div><div class="muted">'+escapeHtml(g.desc||"")+'</div></div>';
    if(iAmHost){card.onclick=function(){send({t:"select_game",id:id});};}
    list.appendChild(card);
  });
  $("hubHint").textContent=iAmHost?"Tu es l'hote, clique sur un jeu.":"En attente que l'hote choisisse un jeu.";
  renderPlayerChips("hubPlayers");
  setStatus("Hub - "+myName);
}

function renderLobby(game){
  show("s-lobby");
  $("lobbyEmoji").textContent=game?game.emoji:"";
  $("lobbyName").textContent=game?game.name:"";
  renderPlayerChips("lobbyPlayers");
  var iAmHost=amHost();
  $("startBtn").style.display=iAmHost?"block":"none";
  $("backToHubBtn").style.display=iAmHost?"block":"none";
  $("lobbyHint").textContent=iAmHost?"Quand tout le monde est la, clique Demarrer.":"En attente du maitre du jeu...";
  setStatus("Lobby - "+myName);
}

function renderQuiz(){
  var r=state.round||{};
  if(state.phase==="playing"){
    show("s-question");
    var locked=(findMe()&&findMe().score!==undefined&&lastAnswerChoice>=0);
    // (using local lastAnswerChoice flag instead of per-player tracking from server for now)
    $("qText").textContent="("+((r.idx||0)+1)+"/"+(r.total||"?")+") "+(r.q||"");
    for(var i=0;i<4;i++){
      var b=$("b"+i);
      b.textContent=(r.options&&r.options[i])||"";
      b.disabled=locked;
    }
    $("qStatus").textContent=locked?"Reponse envoyee, attends les autres...":(r.answered!==undefined?(r.answered+" / "+state.players.length+" repondu(s)"):"");
  } else if(state.phase==="reveal"){
    show("s-reveal");
    var correct=r.correct;
    var ok=(lastAnswerChoice===correct);
    var me=findMe();
    $("myScore").textContent=me?me.score:0;
    $("revealMark").innerHTML=(ok?"&#9989;":"&#10067;");
    $("revealMsg").textContent="Bonne reponse : "+["A","B","C","D"][correct];
    $("nextBtn").style.display=amHost()?"block":"none";
    lastAnswerChoice=-1;
  } else if(state.phase==="finished"){
    show("s-end");
    var ol=$("board");ol.innerHTML="";
    var sorted=state.players.slice().sort(function(a,b){return b.score-a.score;});
    sorted.forEach(function(p,i){
      var li=document.createElement("li");
      li.innerHTML="<span>"+(i+1)+". "+(p.host?"<span class=crown>&#x1F451;</span> ":"")+escapeHtml(p.name)+"</span><b>"+p.score+"</b>";
      ol.appendChild(li);
    });
    $("resetBtn").style.display=amHost()?"block":"none";
    lastAnswerChoice=-1;
  } else {
    // quiz lobby is handled by renderLobby() above
  }
}

function escapeHtml(t){var d=document.createElement("div");d.textContent=t;return d.innerHTML;}

$("joinBtn").onclick=function(){
  var n=$("name").value.trim();if(!n)return;myName=n.substring(0,16);
  send({t:"join",name:myName});
};
$("startBtn").onclick=function(){send({t:"next"});};
$("backToHubBtn").onclick=function(){send({t:"select_game",id:""});};
$("nextBtn").onclick=function(){send({t:"next"});};
$("resetBtn").onclick=function(){send({t:"reset"});};
for(var i=0;i<4;i++){(function(i){
  $("b"+i).onclick=function(){
    if(lastAnswerChoice>=0)return;
    lastAnswerChoice=i;
    send({t:"answer",choice:i});
    for(var j=0;j<4;j++)$("b"+j).disabled=true;
    $("qStatus").textContent="Reponse envoyee, attends les autres...";
  };
})(i);}

connect();show("s-join");
</script></body></html>)HTML";

// ---------------------------------------------------------------------------
// Admin control panel (HTTP Basic Auth)
// ---------------------------------------------------------------------------
static const char ADMIN_HTML[] PROGMEM = R"HTML(<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GamesHub - Admin</title>
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
<h1>GamesHub &mdash; Admin</h1>
<div class="card">
  <div class="row"><span>Jeu</span><b id="game">-</b></div>
  <div class="row"><span>Phase</span><b id="phase">...</b></div>
  <div class="row"><span>Joueurs</span><b id="players">0</b></div>
  <div class="row"><span>Hote</span><b id="host">-</b></div>
  <div class="row"><span>Progression</span><b id="progress">-</b></div>
</div>
<button class="next" onclick="act('next')">Demarrer / Suivant</button>
<button class="reset" onclick="act('reset')">Reset</button>
<p><a href="/">Retour a la page joueur</a></p>
<script>
function act(a){fetch('/admin/'+a).then(refresh);}
function refresh(){fetch('/admin/state').then(function(r){return r.json();}).then(function(s){
  document.getElementById('game').textContent=s.game||'-';
  document.getElementById('phase').textContent=s.phase;
  document.getElementById('players').textContent=s.players;
  document.getElementById('host').textContent=s.host||'-';
  document.getElementById('progress').textContent=s.progress||'-';
}).catch(function(){});}
setInterval(refresh,1500);refresh();
</script></body></html>)HTML";

// ---------------------------------------------------------------------------
// Unified state push (the single choke point: WS broadcast + Flipper update).
// Called by the core after every game hook and after tick() returns true.
// ---------------------------------------------------------------------------
static void broadcastState() {
    JsonDocument doc;
    doc["t"]      = "state";
    GamePhase ph  = current_game ? current_game->phase() : GAME_PHASE_LOBBY;
    doc["phase"]  = phase_str(ph);
    if (current_game) doc["game"] = current_game->id;
    else              doc["game"] = (const char*)nullptr;
    doc["hostId"] = host_id;

    JsonArray pa = doc["players"].to<JsonArray>();
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (!players[i].name[0]) continue;  // never assigned
        JsonObject po = pa.add<JsonObject>();
        po["id"]        = players[i].clientId;
        po["name"]      = players[i].name;
        po["score"]     = players[i].score;
        po["connected"] = players[i].active;
        po["host"]      = host_is(players[i].clientId);
    }

    JsonObject round = doc["round"].to<JsonObject>();
    if (current_game && current_game->serialize_round) current_game->serialize_round(round);

    String out; serializeJson(doc, out);
    ws.textAll(out);

    sendToFlipper();
}

static void sendToFlipper() {
    flipper_uart_printf("PLAYERS:%d\n", activeCount());
    GamePhase ph = current_game ? current_game->phase() : GAME_PHASE_LOBBY;
    flipper_uart_printf("STATE:%s\n", phase_str(ph));
    Player* h = host_get();
    flipper_uart_printf("HOST:%s\n", h ? h->name : "");
    flipper_uart_printf("GAME:%s\n", current_game ? current_game->id : "");
    char prog[32]; prog[0] = '\0';
    if (current_game && current_game->flipper_progress) current_game->flipper_progress(prog, sizeof(prog));
    flipper_uart_printf("PROGRESS:%s\n", prog);
}

// ---------------------------------------------------------------------------
// Flipper UART command handler — buttons act as host actions (gamemaster).
// ---------------------------------------------------------------------------
static void onFlipperCommand(const char* cmd) {
    GAME_LOCK();
    if (!current_game) {
        // No game selected yet: NEXT auto-picks the first registered game so
        // the Flipper alone (no host yet) can still kick things off.
        if (strcmp(cmd, "NEXT") == 0 || strcmp(cmd, "START") == 0) {
            if (GAMES_COUNT > 0) {
                game_select(GAMES[0]);
                current_game->on_advance();
                broadcastState();
            }
        }
    } else {
        if (strcmp(cmd, "NEXT") == 0 || strcmp(cmd, "START") == 0) {
            current_game->on_advance();
            broadcastState();
        } else if (strcmp(cmd, "RESET") == 0) {
            current_game->on_reset();
            broadcastState();
        }
    }
    GAME_UNLOCK();
}

// ---------------------------------------------------------------------------
// WebSocket message dispatch
// ---------------------------------------------------------------------------
static void handleMessage(AsyncWebSocketClient* client, uint8_t* data, size_t len) {
    JsonDocument doc;
    if (deserializeJson(doc, data, len)) return;
    const char* t = doc["t"] | (const char*)nullptr;
    if (!t) return;

    GAME_LOCK();

    if (strcmp(t, "join") == 0) {
        const char* name = doc["name"] | "Joueur";
        Player* p = findReconnectSlot(name);
        if (!p) p = findPlayer(client->id());
        if (!p) p = addPlayer(client->id());
        if (p) {
            p->active   = true;
            p->clientId = client->id();
            strncpy(p->name, name, MAX_NAME_LEN);
            p->name[MAX_NAME_LEN] = '\0';
            host_recompute();
            if (current_game && current_game->on_player_join) current_game->on_player_join(p);
            broadcastState();
        }
    } else if (strcmp(t, "select_game") == 0) {
        // H6: only the host may pick the game.
        if (host_is(client->id())) {
            const char* id = doc["id"] | "";
            if (id[0] == '\0') {
                current_game = nullptr;  // back to hub
            } else {
                const Game* g = game_find_by_id(id);
                if (g) game_select(g);
            }
            broadcastState();
        }
    } else if (strcmp(t, "next") == 0 || strcmp(t, "start") == 0) {
        if (host_is(client->id()) && current_game) {
            current_game->on_advance();
            broadcastState();
        }
    } else if (strcmp(t, "reset") == 0) {
        if (host_is(client->id()) && current_game) {
            current_game->on_reset();
            broadcastState();
        }
    } else if (current_game && current_game->on_message) {
        Player* p = findPlayer(client->id());
        if (p) {
            current_game->on_message(p, doc);
            broadcastState();
        }
    }

    GAME_UNLOCK();
}

static void onWsEvent(AsyncWebSocket*, AsyncWebSocketClient* client,
                      AwsEventType type, void* arg, uint8_t* data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        // Push current state to the freshly connected client so it can render
        // immediately (it may then send a {t:"join"} for reconnect).
        GAME_LOCK();
        broadcastState();
        GAME_UNLOCK();
    } else if (type == WS_EVT_DISCONNECT) {
        GAME_LOCK();
        Player* p = findPlayer(client->id());
        removePlayer(client->id());
        host_recompute();
        if (current_game && current_game->on_player_leave && p) current_game->on_player_leave(p);
        broadcastState();
        GAME_UNLOCK();
    } else if (type == WS_EVT_DATA) {
        AwsFrameInfo* info = (AwsFrameInfo*)arg;
        if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT)
            handleMessage(client, data, len);
    }
}

// ---------------------------------------------------------------------------
// HTTP routes
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

    server.on("/admin", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        req->send(200, "text/html", ADMIN_HTML);
    });
    server.on("/admin/state", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        GAME_LOCK();
        GamePhase ph = current_game ? current_game->phase() : GAME_PHASE_LOBBY;
        const char* phStr = phase_str(ph);
        const char* gameId = current_game ? current_game->id : "";
        int pc = activeCount();
        Player* h = host_get();
        char progress[32]; progress[0] = '\0';
        if (current_game && current_game->flipper_progress) current_game->flipper_progress(progress, sizeof(progress));
        GAME_UNLOCK();
        JsonDocument doc;
        doc["phase"]   = phStr;
        doc["game"]    = gameId;
        doc["players"] = pc;
        doc["host"]    = h ? h->name : "";
        doc["progress"] = progress;
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });
    auto admin_advance = [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        GAME_LOCK();
        if (!current_game && GAMES_COUNT > 0) game_select(GAMES[0]);
        if (current_game) current_game->on_advance();
        broadcastState();
        GAME_UNLOCK();
        req->send(200, "text/plain", "ok");
    };
    server.on("/admin/start", HTTP_GET, admin_advance);
    server.on("/admin/next",  HTTP_GET, admin_advance);
    server.on("/admin/reset", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        GAME_LOCK();
        if (current_game) current_game->on_reset();
        broadcastState();
        GAME_UNLOCK();
        req->send(200, "text/plain", "ok");
    });

    // Captive-portal probe handling (see CAPTIVE_PORTAL_ENABLED comment above).
    server.onNotFound([](AsyncWebServerRequest* req) {
#if CAPTIVE_PORTAL_ENABLED
        req->redirect("http://192.168.4.1/");
#else
        String url = req->url();
        if (url.endsWith("/generate_204") || url == "/gen_204") {
            req->send(204);
        } else if (url.indexOf("ncsi.txt") >= 0) {
            req->send(200, "text/plain", "Microsoft NCSI");
        } else if (url.indexOf("connecttest.txt") >= 0) {
            req->send(200, "text/plain", "Microsoft Connect Test");
        } else if (url.indexOf("hotspot-detect") >= 0 || url.indexOf("success.html") >= 0
                || url.indexOf("library/test") >= 0) {
            req->send(200, "text/html",
                "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>");
        } else {
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

    Serial.printf("[GamesHub] %d game(s) registered\n", GAMES_COUNT);
}

void loop() {
    wifi_portal_poll();
    ws.cleanupClients();
    flipper_uart_poll();

    GAME_LOCK();
    if (current_game && current_game->tick) {
        if (current_game->tick(millis())) broadcastState();
    }
    GAME_UNLOCK();
}
