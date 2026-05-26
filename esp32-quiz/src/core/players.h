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
};

extern Player players[MAX_PLAYERS];

// Lookup an active player by its WebSocket client id.
Player* findPlayer(uint32_t clientId);

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
