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
