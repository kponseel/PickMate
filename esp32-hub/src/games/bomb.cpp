#include "bomb.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

namespace {

GamePhase phase             = GAME_PHASE_LOBBY;
int       holder_slot       = -1;
uint32_t  bomb_deadline_ms  = 0;
uint32_t  round_n           = 0;
int       boom_count[MAX_PLAYERS] = {0};

int slot_of(const Player* p) {
    if (!p) return -1;
    int idx = (int)(p - players);
    return (idx >= 0 && idx < MAX_PLAYERS) ? idx : -1;
}

int random_active_slot(int exclude) {
    int actives[MAX_PLAYERS]; int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0] && i != exclude) actives[n++] = i;
    if (n == 0) return -1;
    return actives[random(n)];
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY;
    holder_slot = -1;
    bomb_deadline_ms = 0;
    round_n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) boom_count[i] = 0;
}

void on_start_impl() {
    int s = random_active_slot(-1);
    if (s < 0) return;
    holder_slot = s;
    // 20-60s hidden timer
    bomb_deadline_ms = millis() + (uint32_t)(20000 + random(40000));
    phase = GAME_PHASE_PLAYING;
    round_n++;
}

void on_advance_impl() {
    if      (phase == GAME_PHASE_LOBBY)   on_start_impl();
    else if (phase == GAME_PHASE_REVEAL)  on_start_impl();   // launch next round
    else                                  on_select_impl();  // PLAYING/FINISHED → cancel
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* /*p*/) {}

void on_player_leave_impl(Player* p) {
    int slot = slot_of(p);
    if (phase != GAME_PHASE_PLAYING) return;
    if (slot != holder_slot) return;
    // Holder bailed: hand the bomb to someone else; if nobody else, end round.
    int next = random_active_slot(slot);
    if (next < 0) { phase = GAME_PHASE_LOBBY; holder_slot = -1; return; }
    holder_slot = next;
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING) return;
    int slot = slot_of(p);
    if (slot != holder_slot) return;
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t || strcmp(t, "pass") != 0) return;
    uint32_t target_id = msg["target_id"] | 0u;
    Player* tg = findPlayer(target_id);
    int tslot = slot_of(tg);
    if (tslot < 0 || tslot == slot) return;
    if (!players[tslot].active || !players[tslot].name[0]) return;
    holder_slot = tslot;
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["round_n"] = round_n;
    if (phase == GAME_PHASE_LOBBY) return;
    if (holder_slot >= 0) {
        round["holder_id"]   = players[holder_slot].clientId;
        round["holder_name"] = players[holder_slot].name;
    }
    if (phase == GAME_PHASE_REVEAL) {
        round["boomed"] = (holder_slot >= 0) ? (const char*)players[holder_slot].name : (const char*)"";
        JsonArray sb = round["scoreboard"].to<JsonArray>();
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (players[i].name[0] && boom_count[i] > 0) {
                JsonObject o = sb.add<JsonObject>();
                o["name"]  = players[i].name;
                o["booms"] = boom_count[i];
            }
        }
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING && holder_slot >= 0)
        snprintf(out, cap, "bombe: %s", players[holder_slot].name);
    else if (phase == GAME_PHASE_REVEAL && holder_slot >= 0)
        snprintf(out, cap, "BOOM %s", players[holder_slot].name);
    else
        out[0] = '\0';
}

bool tick_impl(uint32_t now_ms) {
    if (phase != GAME_PHASE_PLAYING) return false;
    if (now_ms < bomb_deadline_ms) return false;
    // Boom!
    if (holder_slot >= 0 && holder_slot < MAX_PLAYERS) {
        boom_count[holder_slot]++;
    }
    phase = GAME_PHASE_REVEAL;
    return true;
}

}  // namespace

const Game BOMB_GAME = {
    /* id              */ "bomb",
    /* name            */ "La Bombe",
    /* emoji           */ "\xF0\x9F\x92\xA3",  // 💣
    /* on_select       */ on_select_impl,
    /* on_start        */ on_start_impl,
    /* on_advance      */ on_advance_impl,
    /* on_reset        */ on_reset_impl,
    /* on_player_join  */ on_player_join_impl,
    /* on_player_leave */ on_player_leave_impl,
    /* on_message      */ on_message_impl,
    /* phase           */ phase_impl,
    /* serialize_round */ serialize_round_impl,
    /* flipper_progress*/ flipper_progress_impl,
    /* serialize_private*/ nullptr,
    /* tick            */ tick_impl,
};
