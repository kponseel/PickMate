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
#include <LittleFS.h>

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

// Web assets (player SPA + admin panel) live under data/ and are served
// from LittleFS — see C6 commit and `pio run -t uploadfs`.


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
        req->send(LittleFS, "/index.html", "text/html");
    });

    server.on("/admin", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        req->send(LittleFS, "/admin.html", "text/html");
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
            req->send(LittleFS, "/index.html", "text/html");
        }
#endif
    });

    // Static assets folder (css/, js/, future games/...): served as-is.
    server.serveStatic("/css/", LittleFS, "/css/");
    server.serveStatic("/js/",  LittleFS, "/js/");

    server.begin();
}

// ---------------------------------------------------------------------------
void setup() {
    Serial.begin(115200);
    gameMutex = xSemaphoreCreateMutex();

    if (!LittleFS.begin(/*formatOnFail=*/true)) {
        Serial.println("[GamesHub] LittleFS mount failed — did you run `pio run -t uploadfs`?");
    } else {
        Serial.printf("[GamesHub] LittleFS mounted (used %u / %u bytes)\n",
                      (unsigned)LittleFS.usedBytes(), (unsigned)LittleFS.totalBytes());
    }

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
