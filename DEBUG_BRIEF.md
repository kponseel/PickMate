# DEBUG BRIEF — GamesHub (ESP32-S2 + Flipper Zero)

> Référence d'architecture + debug, À JOUR. Plateforme multi-jeux GamesHub.
> Le **code du CŒUR (infra)** est embarqué plus bas ; les 16 modules de jeu sont
> seulement listés (ce sont des plug-ins de contenu). Repo : github.com/kponseel/PickMate

## Objectif
Plateforme de jeux de soirée multi-téléphone, **locale et hors-ligne**. La Wi-Fi
Dev Board (ESP32-S2) crée un AP Wi-Fi ouvert, sert une SPA web (LittleFS) aux
téléphones (portail captif + WebSocket), élit un « host » (maître du jeu) et
synchronise l'état. Le Flipper Zero affiche l'état ; ses boutons pilotent le jeu
(OK=NEXT, Bas=RESET). Chaque jeu est un module branché sur le registre GAMES[].

## Matériel & versions
- Flipper Zero **OFW 1.4.3**, sur **COM3** (Windows 11).
- **Wi-Fi Developer Board officielle (ESP32-S2)**.
- PlatformIO (Arduino) pour l'ESP32 ; ufbt pour l'app Flipper.

## Architecture
```
 [Téléphones]            [ESP32-S2 / Wi-Fi board]            [Flipper Zero]
      | Wi-Fi ouvert + SPA (LittleFS) + WebSocket |               |
      +------------------------------------------+               |
                                |  UART 115200 8N1 (texte, \n)   |
                                +--------------------------------+
```
- `esp32-hub/src/main.cpp` = cœur (lobby, hub WS, pompe UART, push d'état unifié, routes HTTP).
- `esp32-hub/src/core/` = infra : `players` (+host), `flipper_uart`, `wifi_portal`, `event_log`.
- `esp32-hub/src/games/` = un module par jeu, interface `Game` (voir `game_api.h`).
- `esp32-hub/data/` = SPA web (`index.html`, `admin.html`, `css/`, `js/`) servie via LittleFS.
- `apps/gameshub/` = app Flipper (UART).

## Protocole UART (115200 8N1, lignes ASCII '\n') — core/flipper_uart.*
ESP32 -> Flipper : `PLAYERS:<n>` | `STATE:<lobby|playing|reveal|finished>` | `HOST:<name>` | `GAME:<id>` | `PROGRESS:<texte>`
Flipper -> ESP32 : `NEXT` / `START` (advance) | `RESET`
Pins : ESP32-S2 **GPIO44=RX** (<- Flipper pin13 TX), **GPIO43=TX** (-> Flipper pin14 RX). Croisement TX<->RX.

## Protocole WebSocket (ws://192.168.4.1/ws, JSON, champ "t")
Client -> serveur :
  {"t":"join","name":"Bob"}
  {"t":"select_game","id":"quiz"}   (host uniquement)
  {"t":"next"|"start"}              (host uniquement)
  {"t":"reset"}                     (host uniquement)
  + messages spécifiques au jeu -> current_game->on_message(player, msg)
Serveur -> client :
  {"t":"state","phase","game","hostId","players":[{id,name,score,connected,host,ip,connect_count,first_seen_ms,last_seen_ms,answered,answer?}],"round":{...}}
  {"t":"private","round":{...}}     (whisper par client : rôle/mot/question secrète — undercover, spyfall, paranoia…)

## Endpoints HTTP
GET /              -> index.html (LittleFS)
GET /admin         -> admin.html (Basic Auth: admin / adminadmin)
GET /admin/state   -> JSON {phase,game,players,host,progress}   (Basic Auth)
GET /admin/start|next|reset -> action                            (Basic Auth)
GET /admin/log     -> journal d'événements                       (Basic Auth)
GET /admin/players -> roster complet (historique)                (Basic Auth)
/ws                -> WebSocket
sinon (onNotFound) -> portail captif (voir CAPTIVE_PORTAL_ENABLED)

## Concept « host » (maître du jeu)
Un host est élu automatiquement parmi les joueurs (`host_recompute` / `host_id`).
Seul le host peut `select_game`/`next`/`reset` via WebSocket. Le Flipper (boutons)
et `/admin` pilotent aussi (journalisés comme "flipper"/"admin").

## Interface de jeu (games/game_api.h)
`struct Game { id, name, emoji, on_select, on_start, on_advance, on_reset,
on_player_join, on_player_leave, on_message, phase(), serialize_round(),
flipper_progress(), serialize_private(), tick() }`.
⚠️ Tous les hooks sont appelés **avec le mutex tenu** : un module ne reprend
jamais le mutex et n'appelle jamais `broadcastState()` (le cœur le fait après
chaque hook et après `tick()==true`).

## Réglages (en haut de esp32-hub/src/main.cpp)
- `AP_SSID = "Paris - Mini Jeux Gratuits"` ; `AP_PASS = NULL` (réseau ouvert).
- `CAPTIVE_PORTAL_ENABLED = true` (mettre `false` = mode furtif : pas d'avertissement Android, les joueurs tapent http://192.168.4.1).
- `ADMIN_USER/ADMIN_PASS = admin/adminadmin`.
- `gameMutex` (FreeRTOS) sérialise tout l'état (loop() vs tâche AsyncTCP).

## Build & flash (Windows / PlatformIO)
```
cd esp32-hub
pio run -t upload     # firmware ; "Failed to connect" -> BOOT maintenu + RESET, relâche, relance
pio run -t uploadfs   # INDISPENSABLE : data/ -> LittleFS (sinon page vide / /admin 404)
pio device monitor    # "[wifi_portal] AP ... up at 192.168.4.1", "LittleFS mounted", "N game(s) registered"
# App Flipper : fermer qFlipper, puis  cd apps/gameshub && ufbt launch
```

## Test par couche
1. ESP32 seul : monitor -> AP up + LittleFS mounted ; téléphone -> page ; piloter via /admin (admin/adminadmin).
2. UART : chaque advance émet PLAYERS:/STATE:/HOST:/GAME:/PROGRESS: ; envoyer NEXT\n fait avancer.
3. Flipper : "Joueurs" bouge quand un téléphone rejoint = UART OK.

## Pièges
- `uploadfs` OBLIGATOIRE après toute modif sous `esp32-hub/data/`.
- Fermer qFlipper avant `ufbt`.
- board `esp32-s2-saola-1` générique ; libs épinglées (ESPAsyncWebServer v3.11.0, AsyncTCP v3.4.10, ArduinoJson ^7).
- Basic Auth en clair sur Wi-Fi ouvert ; Wi-Fi ESP32 ~8 téléphones max (matériel).

## Jeux enregistrés (modules sous esp32-hub/src/games/, NON embarqués ici)
- bluff
- bomb
- dares
- kings
- most_likely
- never
- paranoia
- picolo
- quips
- quiz
- spyfall
- superlatives
- truth_dare
- undercover
- wolves
- would_rather

---

# CODE SOURCE DU CŒUR (infra à jour ; les 16 jeux sont dans le repo)

## esp32-hub/platformio.ini
```ini
; GamesHub - ESP32-S2 captive-portal multi-game server (Wi-Fi Dev Board)
;
;   Build firmware  : pio run
;   Flash firmware  : pio run -t upload
;   Flash web SPA   : pio run -t uploadfs       (uploads data/ as LittleFS)
;   Serial monitor  : pio device monitor
;
; If your board is not a generic ESP32-S2 Saola, change `board` below.

[env:flipper-wifi-devboard]
platform = espressif32
board = esp32-s2-saola-1
framework = arduino
monitor_speed = 115200
; Web assets live under data/ and are flashed via `pio run -t uploadfs`.
board_build.filesystem = littlefs
build_flags =
    ; ESP32-S2 has native USB: keep Serial (debug) on USB-CDC so UART1 is free for the Flipper
    -D ARDUINO_USB_CDC_ON_BOOT=1
; Async libs pinned to release tags for reproducible builds. If a build error
; says the tag is missing, bump/remove the "#vX.Y.Z" suffix.
lib_deps =
    bblanchon/ArduinoJson @ ^7.0.4
    https://github.com/ESP32Async/ESPAsyncWebServer.git#v3.11.0
    https://github.com/ESP32Async/AsyncTCP.git#v3.4.10
```

## esp32-hub/src/core/players.h
```cpp
// Player roster — shared between the core (web/WS/UART) and game modules.
//
// The fields below are intentionally a superset: a few of them (`score`,
// `answered`, `answer`, `answerMs`) are currently used only by the quiz
// module. They are kept here for now to avoid churn during the first
// extraction commit; a later refactor will move per-game state into each
// game module's own struct, leaving Player as a minimal core record.
#pragma once

#include <Arduino.h>
#include <stdint.h>

#define MAX_PLAYERS  16
#define MAX_NAME_LEN 16

struct Player {
    bool     active;
    uint32_t clientId;
    char     name[MAX_NAME_LEN + 1];

    // Per-game scratch state (see note above)
    uint32_t score;
    bool     answered;
    uint8_t  answer;
    uint32_t answerMs;

    // Device identification & session history (stable across reconnects).
    // `ip` is the IPv4 assigned by softAP DHCP; it's MAC-equivalent in
    // practice (DHCP reuses the same address for the same MAC as long as
    // the lease holds). 0 means "unknown / never connected".
    uint32_t ip;
    uint32_t connect_count;
    uint32_t first_seen_ms;
    uint32_t last_seen_ms;
};

extern Player players[MAX_PLAYERS];

// Lookup an active player by its WebSocket client id.
Player* findPlayer(uint32_t clientId);

// Match by IP (stable device identifier). Prefers an active match; otherwise
// returns a disconnected slot with the same IP. Returns nullptr if `ip` is 0
// or unknown.
Player* findByIp(uint32_t ip);

// A disconnected slot with the same name: lets a reconnecting phone reclaim
// its score instead of starting over.
Player* findReconnectSlot(const char* name);

// Allocate a new slot for `clientId`. Prefers a truly empty slot; otherwise
// evicts a previously disconnected ghost. Returns NULL if the roster is full.
Player* addPlayer(uint32_t clientId);

// Marks a player inactive but keeps its name+score so it can reconnect.
void removePlayer(uint32_t clientId);

// Number of players currently active *with* a non-empty name.
int activeCount();

// -----------------------------------------------------------------------------
// Host election
// -----------------------------------------------------------------------------
// The "host" (👑) is the active player with the smallest clientId. The smallest
// id is stable, deterministic, and naturally re-elected when the current host
// leaves: a single rescan after each join/disconnect is enough.
//
// Per H6: only the host is allowed to start/advance/reset the game and pick
// the next game from the hub. The Flipper buttons and the /admin HTTP endpoints
// bypass this gate (they're explicitly the game master's controls).

extern uint32_t host_id;  // 0 means "no host yet" (empty lobby)

// Rescan the roster and update host_id. Call after every join/disconnect.
void host_recompute();

// Pointer to the current host Player, or nullptr if the lobby is empty.
Player* host_get();

// Convenience: true when this WS client owns the crown.
bool host_is(uint32_t clientId);
```

## esp32-hub/src/core/players.cpp
```cpp
#include "players.h"
#include <string.h>

Player players[MAX_PLAYERS];

Player* findPlayer(uint32_t clientId) {
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].clientId == clientId) return &players[i];
    return nullptr;
}

Player* findByIp(uint32_t ip) {
    if (ip == 0) return nullptr;
    // Active session at this IP (rare race: WS reconnect before DHCP turnover)
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].ip == ip) return &players[i];
    // Disconnected ghost previously seen at this IP
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (!players[i].active && players[i].name[0] && players[i].ip == ip) return &players[i];
    return nullptr;
}

Player* findReconnectSlot(const char* name) {
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (!players[i].active && players[i].name[0] &&
            strncmp(players[i].name, name, MAX_NAME_LEN) == 0)
            return &players[i];
    return nullptr;
}

Player* addPlayer(uint32_t clientId) {
    int reuse = -1;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (!players[i].active && players[i].name[0] == '\0') {  // prefer a truly empty slot
            players[i] = Player{};
            players[i].active   = true;
            players[i].clientId = clientId;
            return &players[i];
        }
        if (!players[i].active && reuse < 0) reuse = i;  // else evict a disconnected ghost
    }
    if (reuse >= 0) {
        players[reuse] = Player{};
        players[reuse].active   = true;
        players[reuse].clientId = clientId;
        return &players[reuse];
    }
    return nullptr;
}

void removePlayer(uint32_t clientId) {
    Player* p = findPlayer(clientId);
    if (p) p->active = false;  // keep name+score so the player can reconnect
}

int activeCount() {
    int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) if (players[i].active && players[i].name[0]) n++;
    return n;
}

uint32_t host_id = 0;

void host_recompute() {
    uint32_t best  = 0;
    bool     found = false;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && players[i].name[0]) {
            if (!found || players[i].clientId < best) {
                best  = players[i].clientId;
                found = true;
            }
        }
    }
    host_id = found ? best : 0;
}

Player* host_get() {
    if (host_id == 0) return nullptr;
    return findPlayer(host_id);
}

bool host_is(uint32_t clientId) {
    return host_id != 0 && clientId == host_id;
}
```

## esp32-hub/src/core/flipper_uart.h
```cpp
// UART link to the Flipper Zero (line-delimited text protocol).
//
// Hardware pin mapping and rationale live in flipper_uart.cpp — DO NOT TOUCH
// the pins unless you know what you are doing (see HARDWARE.md). This header
// only exposes the transport API.
#pragma once

#include <stdint.h>

#define FLIPPER_UART_DEFAULT_BAUD 115200

// Callback fired once per fully-received line (without the trailing \n / \r).
// Runs in the loop()/main task context (not an ISR), so callees may take
// game-state mutexes and call back into the rest of the system freely.
typedef void (*flipper_command_handler_t)(const char* line);

// Initialise the UART on the board-specific pins (see .cpp). Safe to call once
// during setup().
void flipper_uart_begin(uint32_t baud = FLIPPER_UART_DEFAULT_BAUD);

// Register the line callback. Pass nullptr to disable dispatch.
void flipper_uart_set_command_handler(flipper_command_handler_t cb);

// Drain bytes from the hardware FIFO, split them into lines, and invoke the
// registered handler for each complete line. Call from loop().
void flipper_uart_poll();

// Append a raw NUL-terminated string (no newline added).
void flipper_uart_send(const char* s);

// printf-style write to the Flipper. Append your own \n.
void flipper_uart_printf(const char* fmt, ...);
```

## esp32-hub/src/core/flipper_uart.cpp
```cpp
// UART transport to the Flipper Zero.
//
// =============================================================================
//  PINOUT — DO NOT CHANGE WITHOUT READING HARDWARE.md
// =============================================================================
//  On the official Flipper Wi-Fi Developer Board (Model WD), the ESP32-S2's
//  native UART0 pins (GPIO 43/44) are routed to the Flipper's USART pins:
//
//      ESP32-S2 GPIO 43 (TX) --> Flipper pin 14 (USART RX)
//      ESP32-S2 GPIO 44 (RX) <-- Flipper pin 13 (USART TX)
//
//  Anything else will silently fail. The Arduino HardwareSerial(1) object
//  below routes UART1 (free thanks to ARDUINO_USB_CDC_ON_BOOT=1) onto these
//  GPIOs via the ESP32 GPIO matrix.
// =============================================================================
#include "flipper_uart.h"

#include <Arduino.h>
#include <stdarg.h>
#include <string.h>

#define FLIPPER_UART_RX_PIN 44  // <- Flipper pin 13 (TX)
#define FLIPPER_UART_TX_PIN 43  // -> Flipper pin 14 (RX)

#define LINE_BUFFER_MAX 64

static HardwareSerial             FlipperSerial(1);
static flipper_command_handler_t  s_handler = nullptr;
static char                       s_line[LINE_BUFFER_MAX];
static size_t                     s_line_len = 0;

void flipper_uart_begin(uint32_t baud) {
    FlipperSerial.begin(baud, SERIAL_8N1, FLIPPER_UART_RX_PIN, FLIPPER_UART_TX_PIN);
}

void flipper_uart_set_command_handler(flipper_command_handler_t cb) {
    s_handler = cb;
}

void flipper_uart_poll() {
    while (FlipperSerial.available()) {
        char c = (char)FlipperSerial.read();
        if (c == '\n' || c == '\r') {
            if (s_line_len > 0) {
                s_line[s_line_len] = '\0';
                if (s_handler) s_handler(s_line);
            }
            s_line_len = 0;
        } else if (s_line_len < LINE_BUFFER_MAX - 1) {
            s_line[s_line_len++] = c;
        } else {
            // overflow: discard the partial line to resync
            s_line_len = 0;
        }
    }
}

void flipper_uart_send(const char* s) {
    if (!s) return;
    FlipperSerial.write((const uint8_t*)s, strlen(s));
}

void flipper_uart_printf(const char* fmt, ...) {
    char buf[128];
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    if (n > 0) {
        if (n > (int)sizeof(buf) - 1) n = sizeof(buf) - 1;
        FlipperSerial.write((const uint8_t*)buf, n);
    }
}
```

## esp32-hub/src/core/wifi_portal.h
```cpp
// SoftAP + DNS catch-all (the network plumbing every game module reuses).
//
// Captive-portal HTTP probe handling lives in main.cpp / web_server for now
// because it needs access to the embedded SPA. This module only owns the
// Wi-Fi access point and DNS server.
#pragma once

#include <stdint.h>

#define WIFI_PORTAL_DEFAULT_MAX_CONN 8  // ESP32-S2 SoftAP practical ceiling

// Bring up the open or WPA2 access point at 192.168.4.1, plus a DNS catch-all
// that resolves any domain to us (so phones can be captured by the portal or
// reach the SPA at http://192.168.4.1/).
//
//  ssid     : visible network name (e.g. "GamesHub")
//  pass     : NULL for open network, or 8+ char string for WPA2
//  max_conn : stations cap (default 8, hard ceiling ~10 on ESP32-S2)
void wifi_portal_begin(const char* ssid,
                       const char* pass     = nullptr,
                       uint8_t     max_conn = WIFI_PORTAL_DEFAULT_MAX_CONN);

// Call from loop(): pumps the DNS server.
void wifi_portal_poll();
```

## esp32-hub/src/core/wifi_portal.cpp
```cpp
#include "wifi_portal.h"

#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>

static const IPAddress AP_IP(192, 168, 4, 1);
static const IPAddress AP_GATEWAY(192, 168, 4, 1);
static const IPAddress AP_SUBNET(255, 255, 255, 0);
static const byte      DNS_PORT = 53;

static DNSServer dnsServer;

void wifi_portal_begin(const char* ssid, const char* pass, uint8_t max_conn) {
    WiFi.mode(WIFI_AP);
    WiFi.softAPConfig(AP_IP, AP_GATEWAY, AP_SUBNET);
    WiFi.softAP(ssid, pass, /*channel=*/1, /*ssid_hidden=*/0, max_conn);

    dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
    dnsServer.start(DNS_PORT, "*", AP_IP);   // resolve every domain to us

    Serial.printf("[wifi_portal] AP '%s' up at %s (max %u stations)\n",
                  ssid, WiFi.softAPIP().toString().c_str(), (unsigned)max_conn);
}

void wifi_portal_poll() {
    dnsServer.processNextRequest();
}
```

## esp32-hub/src/core/event_log.h
```cpp
// In-memory circular event log for the admin panel.
//
// Records noteworthy lobby/game events (joins, disconnects, host changes,
// game switches, advance/reset) with timestamp and the originating player's
// name + IP. Capacity ~64 events; oldest is overwritten when full. Lives
// purely in RAM — wiped on reboot.
//
// All calls must be invoked with the core's game mutex held (the caller is
// already holding it at the WS / Flipper UART entry points).
#pragma once

#include <ArduinoJson.h>
#include <stdint.h>
#include <stddef.h>

typedef enum {
    EVT_PLAYER_JOIN,
    EVT_PLAYER_LEAVE,
    EVT_HOST_CHANGE,
    EVT_GAME_SELECT,
    EVT_GAME_ADVANCE,
    EVT_GAME_RESET,
    EVT_GAME_PHASE,        // payload = new phase ("playing", "reveal", "finished")
} EventType;

// Push a new event. `name` and `payload` may be NULL or empty.
// `ip` is the player's IPv4 (0 if N/A — e.g. anonymous game phase change).
void event_log_record(EventType type, const char* name, uint32_t ip, const char* payload);

// Emit the buffer oldest → newest into the given JsonArray.
// Each entry: {"ts_ms":..., "type":"player_join", "name":"...", "ip":"...", "payload":"..."}
void event_log_serialize(JsonArray out);

// Current number of events stored (0 .. capacity).
int event_log_count();
```

## esp32-hub/src/core/event_log.cpp
```cpp
#include "event_log.h"

#include <Arduino.h>
#include <IPAddress.h>
#include <string.h>

#define EVENT_LOG_CAP 64
#define NAME_MAX      17  // 16 chars + NUL (matches Player.name)
#define PAYLOAD_MAX   24

struct Event {
    uint32_t  ts_ms;
    EventType type;
    char      name[NAME_MAX];
    uint32_t  ip;
    char      payload[PAYLOAD_MAX];
};

static Event s_buf[EVENT_LOG_CAP];
static int   s_head  = 0;   // next write index
static int   s_count = 0;   // current size (<= CAP)

static void copy_field(char* dst, size_t cap, const char* src) {
    if (cap == 0) return;
    if (!src) { dst[0] = '\0'; return; }
    strncpy(dst, src, cap - 1);
    dst[cap - 1] = '\0';
}

void event_log_record(EventType type, const char* name, uint32_t ip, const char* payload) {
    Event* e = &s_buf[s_head];
    e->ts_ms = millis();
    e->type  = type;
    copy_field(e->name,    sizeof(e->name),    name);
    copy_field(e->payload, sizeof(e->payload), payload);
    e->ip    = ip;
    s_head = (s_head + 1) % EVENT_LOG_CAP;
    if (s_count < EVENT_LOG_CAP) s_count++;
}

static const char* type_str(EventType t) {
    switch (t) {
        case EVT_PLAYER_JOIN:  return "player_join";
        case EVT_PLAYER_LEAVE: return "player_leave";
        case EVT_HOST_CHANGE:  return "host_change";
        case EVT_GAME_SELECT:  return "game_select";
        case EVT_GAME_ADVANCE: return "game_advance";
        case EVT_GAME_RESET:   return "game_reset";
        case EVT_GAME_PHASE:   return "game_phase";
    }
    return "?";
}

void event_log_serialize(JsonArray out) {
    int start = (s_count < EVENT_LOG_CAP) ? 0 : s_head;  // oldest first
    for (int i = 0; i < s_count; i++) {
        const Event& e = s_buf[(start + i) % EVENT_LOG_CAP];
        JsonObject o = out.add<JsonObject>();
        o["ts_ms"] = e.ts_ms;
        o["type"]  = type_str(e.type);
        if (e.name[0])    o["name"]    = e.name;
        if (e.ip)         o["ip"]      = IPAddress(e.ip).toString();
        if (e.payload[0]) o["payload"] = e.payload;
    }
}

int event_log_count() { return s_count; }
```

## esp32-hub/src/games/game_api.h
```cpp
// Game module interface.
//
// Each game ships as one source file under games/ that defines a `Game` struct
// and registers it in GAMES[]. The core (WiFi/WS/UART/players/host) talks to
// modules only through this struct — no game-specific code lives outside it.
//
// Concurrency: every hook below is called with the global game mutex already
// held by the core. Modules must NOT take it again, and must NOT call
// broadcastState() themselves — the core does so automatically after each
// hook (and after tick() returns true).
#pragma once

#include <ArduinoJson.h>
#include <stdint.h>
#include <stddef.h>

#include "../core/players.h"

typedef enum {
    GAME_PHASE_LOBBY,      // waiting for the host to start
    GAME_PHASE_PLAYING,    // round in progress (answers/votes/etc. open)
    GAME_PHASE_REVEAL,     // showing the result between rounds
    GAME_PHASE_FINISHED    // final scoreboard
} GamePhase;

struct Game {
    // Identity (stable, used for routing on both sides)
    const char* id;        // "quiz", "most_likely", ...
    const char* name;      // FR label shown in the hub
    const char* emoji;     // single-glyph icon shown in the hub

    // Lifecycle hooks (all called with the game mutex held)
    void (*on_select)(void);                                     // entered from the hub
    void (*on_start)(void);                                      // optional: explicit start (LOBBY -> PLAYING)
    void (*on_advance)(void);                                    // NEXT pressed (Flipper / host / admin)
    void (*on_reset)(void);                                      // RESET (full reset, scores too)

    void (*on_player_join)(Player* p);                           // a player just joined / reconnected
    void (*on_player_leave)(Player* p);                          // a player just disconnected (p->active==false now)

    void (*on_message)(Player* p, const JsonDocument& msg);      // game-specific intent (server is single source of truth)

    // State snapshot
    GamePhase (*phase)(void);
    void (*serialize_round)(JsonObject round);                   // fill the "round" field of the state push
    void (*flipper_progress)(char* out, size_t cap);             // PROGRESS:<text> line for the Flipper display

    // Per-client private payload (optional, may be NULL). If set, the core
    // calls this once per connected player just after broadcastState() and
    // pushes a separate {t:"private",round:{...}} message to that client
    // alone. Use it for secrets that other phones must NOT see (the asker's
    // question in paranoia, the player's role/word in undercover/spyfall…).
    // Leave the JsonObject empty to skip a given viewer.
    void (*serialize_private)(const Player* viewer, JsonObject out);

    // Periodic tick (timers, bombs, etc.). Returns true if state changed and
    // the core should broadcast. Called every loop iteration.
    bool (*tick)(uint32_t now_ms);
};

// Registry — declared here, defined in game_api.cpp.
extern const Game* GAMES[];
extern int         GAMES_COUNT;

// The game the lobby is currently routed to. NULL when in the hub (no game
// picked yet).
extern const Game* current_game;

// Lookup and switch helpers used by the core.
const Game* game_find_by_id(const char* id);
void        game_select(const Game* g);  // sets current_game and calls on_select()
```

## esp32-hub/src/games/game_api.cpp
```cpp
#include "game_api.h"
#include "quiz.h"
#include "most_likely.h"
#include "never.h"
#include "would_rather.h"
#include "truth_dare.h"
#include "superlatives.h"
#include "paranoia.h"
#include "undercover.h"
#include "spyfall.h"
#include "bluff.h"
#include "quips.h"
#include "bomb.h"
#include "kings.h"
#include "dares.h"
#include "picolo.h"
#include "wolves.h"

#include <string.h>

// Registry: list every game module that should appear in the hub. Order here
// is the order shown to players.
const Game* GAMES[] = {
    &QUIZ_GAME,
    &MOST_LIKELY_GAME,
    &NEVER_GAME,
    &WOULD_RATHER_GAME,
    &TRUTH_DARE_GAME,
    &SUPERLATIVES_GAME,
    &PARANOIA_GAME,
    &UNDERCOVER_GAME,
    &SPYFALL_GAME,
    &BLUFF_GAME,
    &QUIPS_GAME,
    &BOMB_GAME,
    &KINGS_GAME,
    &DARES_GAME,
    &PICOLO_GAME,
    &WOLVES_GAME,
};
int GAMES_COUNT = sizeof(GAMES) / sizeof(GAMES[0]);

const Game* current_game = nullptr;

const Game* game_find_by_id(const char* id) {
    if (!id) return nullptr;
    for (int i = 0; i < GAMES_COUNT; i++) {
        if (strcmp(GAMES[i]->id, id) == 0) return GAMES[i];
    }
    return nullptr;
}

void game_select(const Game* g) {
    current_game = g;
    if (g && g->on_select) g->on_select();
}
```

## esp32-hub/src/main.cpp
```cpp
/*
 * GamesHub — local, offline multiplayer party-game platform for the ESP32-S2
 * Wi-Fi Developer Board clipped onto a Flipper Zero.
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
#include "core/event_log.h"
#include "games/game_api.h"

// ---------------------------------------------------------------------------
// User-configurable settings — edit these to your taste, then re-flash.
// ---------------------------------------------------------------------------

// Wi-Fi network name shown on phones.
static const char* AP_SSID = "Paris - Mini Jeux Gratuits";

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

// Wraps host_recompute() and emits an EVT_HOST_CHANGE only when the crown
// actually moves. Call in place of host_recompute() at every join/disconnect.
static void recompute_host_and_log() {
    uint32_t prev = host_id;
    host_recompute();
    if (host_id != prev) {
        Player* h = host_get();
        event_log_record(EVT_HOST_CHANGE, h ? h->name : "", h ? h->ip : 0, "");
    }
}

// Convenience: who is the host, for "this action came from the host" log lines.
static const char* host_name_or_empty() { Player* h = host_get(); return h ? h->name : ""; }
static uint32_t    host_ip_or_zero()   { Player* h = host_get(); return h ? h->ip   : 0;  }

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
        po["id"]            = players[i].clientId;
        po["name"]          = players[i].name;
        po["score"]         = players[i].score;
        po["connected"]     = players[i].active;
        po["host"]          = host_is(players[i].clientId);
        po["ip"]            = IPAddress(players[i].ip).toString();
        po["connect_count"] = players[i].connect_count;
        po["first_seen_ms"] = players[i].first_seen_ms;
        po["last_seen_ms"]  = players[i].last_seen_ms;
        // Reusable per-round acting state for any "act once per round" game
        // (quiz answer, most_likely vote, never response, etc.). Modules clear
        // these in their on_start hook for each new round.
        po["answered"]      = players[i].answered;
        if (players[i].answered) po["answer"] = players[i].answer;
    }

    JsonObject round = doc["round"].to<JsonObject>();
    if (current_game && current_game->serialize_round) current_game->serialize_round(round);

    String out; serializeJson(doc, out);
    ws.textAll(out);

    // Per-client private payloads (paranoia question, undercover word, ...).
    // Only emitted when the current game opts in via Game::serialize_private.
    if (current_game && current_game->serialize_private) {
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (!players[i].active || !players[i].name[0]) continue;
            AsyncWebSocketClient* client = ws.client(players[i].clientId);
            if (!client || client->status() != WS_CONNECTED) continue;
            JsonDocument pdoc;
            pdoc["t"] = "private";
            JsonObject pr = pdoc["round"].to<JsonObject>();
            current_game->serialize_private(&players[i], pr);
            if (pr.size() == 0) continue;  // nothing to whisper
            String pout; serializeJson(pdoc, pout);
            client->text(pout);
        }
    }

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
                event_log_record(EVT_GAME_SELECT, "flipper", 0, GAMES[0]->id);
                current_game->on_advance();
                event_log_record(EVT_GAME_ADVANCE, "flipper", 0, current_game->id);
                broadcastState();
            }
        }
    } else {
        if (strcmp(cmd, "NEXT") == 0 || strcmp(cmd, "START") == 0) {
            current_game->on_advance();
            event_log_record(EVT_GAME_ADVANCE, "flipper", 0, current_game->id);
            broadcastState();
        } else if (strcmp(cmd, "RESET") == 0) {
            current_game->on_reset();
            event_log_record(EVT_GAME_RESET, "flipper", 0, current_game->id);
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
        uint32_t ip = (uint32_t)client->remoteIP();

        // Re-identification priority:
        //  1) Same device (IP) → keep score & history even if pseudo changed
        //  2) Same pseudo → classic name-based reconnect
        //  3) Existing slot on this WS client → already-joined edge case
        //  4) Fresh slot
        Player* p = findByIp(ip);
        if (!p) p = findReconnectSlot(name);
        if (!p) p = findPlayer(client->id());
        if (!p) p = addPlayer(client->id());

        if (p) {
            uint32_t now = millis();
            p->active   = true;
            p->clientId = client->id();
            p->ip       = ip;
            if (p->first_seen_ms == 0) p->first_seen_ms = now;
            p->last_seen_ms = now;
            p->connect_count++;
            strncpy(p->name, name, MAX_NAME_LEN);
            p->name[MAX_NAME_LEN] = '\0';
            event_log_record(EVT_PLAYER_JOIN, p->name, p->ip, "");
            recompute_host_and_log();
            if (current_game && current_game->on_player_join) current_game->on_player_join(p);
            broadcastState();
        }
    } else if (strcmp(t, "select_game") == 0) {
        // H6: only the host may pick the game.
        if (host_is(client->id())) {
            const char* id = doc["id"] | "";
            if (id[0] == '\0') {
                current_game = nullptr;  // back to hub
                event_log_record(EVT_GAME_SELECT, host_name_or_empty(), host_ip_or_zero(), "");
            } else {
                const Game* g = game_find_by_id(id);
                if (g) {
                    game_select(g);
                    event_log_record(EVT_GAME_SELECT, host_name_or_empty(), host_ip_or_zero(), g->id);
                }
            }
            broadcastState();
        }
    } else if (strcmp(t, "next") == 0 || strcmp(t, "start") == 0) {
        if (host_is(client->id()) && current_game) {
            current_game->on_advance();
            event_log_record(EVT_GAME_ADVANCE, host_name_or_empty(), host_ip_or_zero(), current_game->id);
            broadcastState();
        }
    } else if (strcmp(t, "reset") == 0) {
        if (host_is(client->id()) && current_game) {
            current_game->on_reset();
            event_log_record(EVT_GAME_RESET, host_name_or_empty(), host_ip_or_zero(), current_game->id);
            broadcastState();
        }
    } else if (current_game && current_game->on_message) {
        Player* p = findPlayer(client->id());
        if (p) {
            p->last_seen_ms = millis();
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
        if (p) {
            p->last_seen_ms = millis();
            event_log_record(EVT_PLAYER_LEAVE, p->name, p->ip, "");
        }
        removePlayer(client->id());
        recompute_host_and_log();
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
        if (!current_game && GAMES_COUNT > 0) {
            game_select(GAMES[0]);
            event_log_record(EVT_GAME_SELECT, "admin", 0, GAMES[0]->id);
        }
        if (current_game) {
            current_game->on_advance();
            event_log_record(EVT_GAME_ADVANCE, "admin", 0, current_game->id);
        }
        broadcastState();
        GAME_UNLOCK();
        req->send(200, "text/plain", "ok");
    };
    server.on("/admin/start", HTTP_GET, admin_advance);
    server.on("/admin/next",  HTTP_GET, admin_advance);
    server.on("/admin/reset", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        GAME_LOCK();
        if (current_game) {
            current_game->on_reset();
            event_log_record(EVT_GAME_RESET, "admin", 0, current_game->id);
        }
        broadcastState();
        GAME_UNLOCK();
        req->send(200, "text/plain", "ok");
    });

    // Event log feed for the admin panel.
    server.on("/admin/log", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        GAME_LOCK();
        JsonDocument doc;
        JsonArray arr = doc["events"].to<JsonArray>();
        event_log_serialize(arr);
        doc["count"]    = event_log_count();
        doc["now_ms"]   = millis();
        GAME_UNLOCK();
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
    });

    // Full player roster (history fields included) for the admin panel.
    server.on("/admin/players", HTTP_GET, [](AsyncWebServerRequest* req) {
        if (!adminAuth(req)) return;
        GAME_LOCK();
        JsonDocument doc;
        JsonArray arr = doc["players"].to<JsonArray>();
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (!players[i].name[0]) continue;
            JsonObject po = arr.add<JsonObject>();
            po["name"]          = players[i].name;
            po["score"]         = players[i].score;
            po["connected"]     = players[i].active;
            po["host"]          = host_is(players[i].clientId);
            po["ip"]            = IPAddress(players[i].ip).toString();
            po["connect_count"] = players[i].connect_count;
            po["first_seen_ms"] = players[i].first_seen_ms;
            po["last_seen_ms"]  = players[i].last_seen_ms;
        }
        doc["now_ms"] = millis();
        GAME_UNLOCK();
        String out; serializeJson(doc, out);
        req->send(200, "application/json", out);
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

    // Seed Arduino's random() from the ESP32 hardware RNG so games that pull
    // random prompts (truth_dare) don't start with the same sequence every
    // boot.
    randomSeed(esp_random());

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
```

## apps/gameshub/application.fam
```python
App(
    appid="gameshub",
    name="GamesHub",
    apptype=FlipperAppType.EXTERNAL,
    entry_point="gameshub_app",
    stack_size=4 * 1024,
    fap_category="GPIO",
    fap_author="kponseel",
    fap_version="1.0",
    fap_description="Host controller for the GamesHub ESP32 party-game platform (UART).",
)
```

## apps/gameshub/gameshub.c
```cpp
/*
 * GamesHub — Flipper Zero companion app for the GamesHub ESP32 server.
 *
 * Generic dashboard for the GamesHub party-games platform: shows live state
 * pushed by the ESP32 over UART and turns the Flipper's physical buttons
 * into host actions on whichever game is currently selected.
 *
 * Buttons (these are gamemaster controls; they bypass the H6 host gate):
 *   OK   -> "NEXT"  (start / reveal / next round / new game on hub)
 *   Down -> "RESET" (full reset)
 *   Back -> quit
 *
 * UART protocol (line-based, 115200 baud, ESP32 -> Flipper):
 *   PLAYERS:<n>         number of active players
 *   STATE:<phase>       lobby | playing | reveal | finished
 *   HOST:<name>         current host's pseudo (empty if lobby empty)
 *   GAME:<id>           selected game id (e.g. "quiz"), empty in the hub
 *   PROGRESS:<text>     game-specific progress hint (e.g. "2/5")
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
#define LINE_MAX        72
#define FIELD_MAX       28

typedef struct {
    int  players;
    char state[FIELD_MAX];
    char host[FIELD_MAX];
    char game[FIELD_MAX];
    char progress[FIELD_MAX];
} HubState;

typedef struct {
    Gui*                 gui;
    ViewPort*            view_port;
    FuriMessageQueue*    input_queue;
    FuriMutex*           mutex;
    FuriHalSerialHandle* serial;
    FuriThread*          worker;
    FuriStreamBuffer*    rx_stream;
    HubState             hub;
    volatile bool        running;
} App;

// --- UART ------------------------------------------------------------------
static void uart_rx_cb(FuriHalSerialHandle* handle, FuriHalSerialRxEvent event, void* context) {
    App* app = context;
    if(event == FuriHalSerialRxEventData) {
        uint8_t b = furi_hal_serial_async_rx(handle);
        furi_stream_buffer_send(app->rx_stream, &b, 1, 0);
    }
}

static void uart_send(App* app, const char* s) {
    if(!app->serial) return;
    furi_hal_serial_tx(app->serial, (const uint8_t*)s, strlen(s));
}

static void copy_field(char* dest, size_t cap, const char* src) {
    strncpy(dest, src, cap - 1);
    dest[cap - 1] = '\0';
}

static void parse_line(App* app, const char* line) {
    furi_mutex_acquire(app->mutex, FuriWaitForever);
    if(strncmp(line, "PLAYERS:", 8) == 0) {
        app->hub.players = atoi(line + 8);
    } else if(strncmp(line, "STATE:", 6) == 0) {
        copy_field(app->hub.state, sizeof(app->hub.state), line + 6);
    } else if(strncmp(line, "HOST:", 5) == 0) {
        copy_field(app->hub.host, sizeof(app->hub.host), line + 5);
    } else if(strncmp(line, "GAME:", 5) == 0) {
        copy_field(app->hub.game, sizeof(app->hub.game), line + 5);
    } else if(strncmp(line, "PROGRESS:", 9) == 0) {
        copy_field(app->hub.progress, sizeof(app->hub.progress), line + 9);
    }
    furi_mutex_release(app->mutex);
    view_port_update(app->view_port);
}

static int32_t uart_worker(void* context) {
    App* app = context;
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
    App* app = ctx;
    furi_mutex_acquire(app->mutex, FuriWaitForever);
    HubState s = app->hub;
    furi_mutex_release(app->mutex);

    char buf[48];
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 2, 11, "GamesHub");

    canvas_set_font(canvas, FontSecondary);

    snprintf(buf, sizeof(buf), "Jeu: %s", s.game[0] ? s.game : "-");
    canvas_draw_str(canvas, 2, 23, buf);

    if(s.host[0]) {
        snprintf(buf, sizeof(buf), "Joueurs: %d  Hote: %s", s.players, s.host);
    } else {
        snprintf(buf, sizeof(buf), "Joueurs: %d", s.players);
    }
    canvas_draw_str(canvas, 2, 34, buf);

    snprintf(buf, sizeof(buf), "Etat: %s", s.state[0] ? s.state : "...");
    canvas_draw_str(canvas, 2, 45, buf);

    if(s.progress[0]) {
        snprintf(buf, sizeof(buf), "%s", s.progress);
        canvas_draw_str(canvas, 2, 56, buf);
    }

    canvas_draw_str(canvas, 2, 63, "OK:Suivant  Bas:Reset");
}

static void input_cb(InputEvent* input_event, void* ctx) {
    FuriMessageQueue* queue = ctx;
    furi_message_queue_put(queue, input_event, FuriWaitForever);
}

// --- App -------------------------------------------------------------------
int32_t gameshub_app(void* p) {
    UNUSED(p);

    App* app = malloc(sizeof(App));
    memset(app, 0, sizeof(App));
    app->running     = true;
    app->mutex       = furi_mutex_alloc(FuriMutexTypeNormal);
    app->input_queue = furi_message_queue_alloc(8, sizeof(InputEvent));
    app->rx_stream   = furi_stream_buffer_alloc(RX_STREAM_SIZE, 1);
    strcpy(app->hub.state, "...");

    app->view_port = view_port_alloc();
    view_port_draw_callback_set(app->view_port, draw_cb, app);
    view_port_input_callback_set(app->view_port, input_cb, app->input_queue);
    app->gui = furi_record_open(RECORD_GUI);
    gui_add_view_port(app->gui, app->view_port, GuiLayerFullscreen);

    app->serial = furi_hal_serial_control_acquire(FuriHalSerialIdUsart);
    if(app->serial) {
        furi_hal_serial_init(app->serial, UART_BAUD);
        furi_hal_serial_async_rx_start(app->serial, uart_rx_cb, app, false);
        app->worker = furi_thread_alloc_ex("GamesHubUart", 2048, uart_worker, app);
        furi_thread_start(app->worker);
    } else {
        // USART held by another process (qFlipper / CLI / another GPIO app):
        // surface it on screen instead of crashing on furi_check.
        copy_field(app->hub.state, sizeof(app->hub.state), "USART occupe!");
    }

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
    if(app->worker) {
        furi_thread_join(app->worker);
        furi_thread_free(app->worker);
    }
    if(app->serial) {
        furi_hal_serial_async_rx_stop(app->serial);
        furi_hal_serial_deinit(app->serial);
        furi_hal_serial_control_release(app->serial);
    }

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
