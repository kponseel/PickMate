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
