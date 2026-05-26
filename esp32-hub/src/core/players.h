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
