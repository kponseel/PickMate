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
