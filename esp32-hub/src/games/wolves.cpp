#include "wolves.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

namespace {

// Roles, never mutated after assign_roles:
//   0xFF = not playing this game (late joiner / never in a round)
//   0    = village
//   1    = wolf
uint8_t   roles[MAX_PLAYERS]    = {0};
bool      alive[MAX_PLAYERS]    = {false};

GamePhase phase                 = GAME_PHASE_LOBBY;
int       step                  = 0;        // 0 = night vote, 1 = day vote
int       vote_counts[MAX_PLAYERS] = {0};
int       last_victim_slot      = -1;
const char* last_kill_type      = "";       // "night" or "day"
int       round_n               = 0;
const char* winner              = "";       // "villagers" / "wolves" while ongoing

int slot_of(const Player* p) {
    if (!p) return -1;
    int idx = (int)(p - players);
    return (idx >= 0 && idx < MAX_PLAYERS) ? idx : -1;
}

void clear_votes() {
    for (int i = 0; i < MAX_PLAYERS; i++) {
        vote_counts[i]      = 0;
        players[i].answered = false;
        players[i].answer   = 0xFF;
    }
}

int count_alive_by_role(uint8_t role) {
    int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].name[0] && alive[i] && roles[i] == role) n++;
    return n;
}

void assign_roles() {
    int actives[MAX_PLAYERS]; int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        roles[i] = 0xFF;
        alive[i] = false;
        if (players[i].active && players[i].name[0]) actives[n++] = i;
    }
    if (n < 4) return;

    for (int i = 0; i < n; i++) {
        roles[actives[i]] = 0;
        alive[actives[i]] = true;
    }
    int n_wolves = (n >= 7) ? 2 : 1;
    for (int picked = 0; picked < n_wolves;) {
        int s = actives[random(n)];
        if (roles[s] != 1) { roles[s] = 1; picked++; }
    }
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY;
    step = 0; last_victim_slot = -1; round_n = 0; winner = "";
    last_kill_type = "";
    for (int i = 0; i < MAX_PLAYERS; i++) { roles[i] = 0xFF; alive[i] = false; }
    clear_votes();
}

void on_start_impl() {
    assign_roles();
    int total = count_alive_by_role(0) + count_alive_by_role(1);
    if (total < 4) return;  // not enough players
    step = 0;
    clear_votes();
    last_victim_slot = -1;
    last_kill_type = "";
    phase = GAME_PHASE_PLAYING;
    round_n = 1;
    winner = "";
}

bool all_wolves_voted() {
    int n = 0, voted = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && roles[i] == 1 && alive[i]) {
            n++;
            if (players[i].answered) voted++;
        }
    }
    return n > 0 && voted == n;
}

bool all_alive_voted() {
    int n = 0, voted = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && alive[i] && (roles[i] == 0 || roles[i] == 1)) {
            n++;
            if (players[i].answered) voted++;
        }
    }
    return n > 0 && voted == n;
}

void tally_and_kill() {
    int max = 0, victim = -1;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].name[0] && alive[i] && vote_counts[i] > max) {
            max    = vote_counts[i];
            victim = i;
        }
    }
    if (victim < 0 || max == 0) { last_victim_slot = -1; return; }
    last_victim_slot = victim;
    alive[victim]    = false;
}

void check_end() {
    int wolves  = count_alive_by_role(1);
    int village = count_alive_by_role(0);
    if (wolves == 0)            { winner = "villagers"; phase = GAME_PHASE_FINISHED; }
    else if (wolves >= village) { winner = "wolves";    phase = GAME_PHASE_FINISHED; }
}

void on_advance_impl() {
    if (phase == GAME_PHASE_LOBBY) { on_start_impl(); return; }

    if (phase == GAME_PHASE_PLAYING) {
        tally_and_kill();
        last_kill_type = (step == 0) ? "night" : "day";
        phase = GAME_PHASE_REVEAL;
        return;
    }

    if (phase == GAME_PHASE_REVEAL) {
        check_end();
        if (phase == GAME_PHASE_FINISHED) return;
        // Toggle step: night → day, day → next night
        if (step == 0) {
            step = 1;
        } else {
            step = 0;
            round_n++;
        }
        clear_votes();
        last_victim_slot = -1;
        last_kill_type = "";
        phase = GAME_PHASE_PLAYING;
        return;
    }

    on_select_impl();   // FINISHED → reset
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* /*p*/) {
    // Late joiners stay as 0xFF (spectator) for this match
}

void on_player_leave_impl(Player* p) {
    int slot = slot_of(p);
    if (slot < 0 || phase != GAME_PHASE_PLAYING) return;
    if (step == 0 && all_wolves_voted()) on_advance_impl();
    else if (step == 1 && all_alive_voted()) on_advance_impl();
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING) return;
    int slot = slot_of(p);
    if (slot < 0) return;
    if (roles[slot] == 0xFF || !alive[slot]) return;
    if (p->answered) return;
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t || strcmp(t, "vote") != 0) return;
    if (step == 0 && roles[slot] != 1) return;   // night: only wolves vote

    uint32_t target_id = msg["target_id"] | 0u;
    Player* tg = findPlayer(target_id);
    int tslot = slot_of(tg);
    if (tslot < 0) return;
    if (!alive[tslot]) return;
    if (step == 0 && roles[tslot] == 1) return;  // wolves don't target wolves at night

    p->answered = true;
    vote_counts[tslot]++;

    if (step == 0 && all_wolves_voted())  on_advance_impl();
    else if (step == 1 && all_alive_voted()) on_advance_impl();
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["round_n"] = round_n;
    if (phase == GAME_PHASE_LOBBY) return;

    round["step"]            = (step == 0) ? "night" : "day";
    round["alive_villagers"] = count_alive_by_role(0);
    round["alive_wolves"]    = count_alive_by_role(1);

    if (phase == GAME_PHASE_PLAYING) {
        int n = 0, voted = 0;
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (players[i].active && alive[i] && (roles[i] == 0 || roles[i] == 1)) {
                if (step == 0 && roles[i] != 1) continue;   // night = wolves
                n++;
                if (players[i].answered) voted++;
            }
        }
        round["voted"]      = voted;
        round["voters"]     = n;
    }
    if (phase == GAME_PHASE_REVEAL && last_victim_slot >= 0) {
        round["victim_name"] = players[last_victim_slot].name;
        round["victim_role"] = (roles[last_victim_slot] == 1) ? "loup" : "villageois";
        round["kill_type"]   = last_kill_type;
    }
    if (phase == GAME_PHASE_FINISHED) {
        round["winner"] = winner;
        JsonArray rs = round["roster"].to<JsonArray>();
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (!players[i].name[0] || roles[i] == 0xFF) continue;
            JsonObject o = rs.add<JsonObject>();
            o["name"]  = players[i].name;
            o["role"]  = (roles[i] == 1) ? "loup" : "villageois";
            o["alive"] = alive[i];
        }
    }
}

void serialize_private_impl(const Player* viewer, JsonObject out) {
    int slot = slot_of(viewer);
    if (slot < 0 || phase == GAME_PHASE_LOBBY) return;
    if (roles[slot] == 0xFF) { out["role"] = "spectator"; return; }
    if (!alive[slot])         { out["role"] = "eliminated"; return; }
    if (roles[slot] == 1) {
        out["role"] = "wolf";
        JsonArray allies = out["allies"].to<JsonArray>();
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (players[i].name[0] && roles[i] == 1) allies.add(players[i].name);
        }
    } else {
        out["role"] = "villager";
    }
    if (phase == GAME_PHASE_PLAYING) {
        bool can_vote = false;
        if (step == 0 && roles[slot] == 1) can_vote = true;
        else if (step == 1)                can_vote = true;
        out["can_vote"] = can_vote;
        if (can_vote) {
            JsonArray vt = out["voteable"].to<JsonArray>();
            for (int i = 0; i < MAX_PLAYERS; i++) {
                if (!players[i].active || !players[i].name[0] || !alive[i]) continue;
                if (step == 0 && roles[i] == 1) continue;
                JsonObject o = vt.add<JsonObject>();
                o["id"]   = players[i].clientId;
                o["name"] = players[i].name;
            }
        }
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING) {
        snprintf(out, cap, "%s J%d L%d/V%d", step == 0 ? "nuit" : "jour",
                 (int)round_n, count_alive_by_role(1), count_alive_by_role(0));
    } else if (phase == GAME_PHASE_REVEAL && last_victim_slot >= 0) {
        snprintf(out, cap, "RIP %s", players[last_victim_slot].name);
    } else if (phase == GAME_PHASE_FINISHED) {
        snprintf(out, cap, "fin: %s", winner);
    } else {
        out[0] = '\0';
    }
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game WOLVES_GAME = {
    /* id              */ "wolves",
    /* name            */ "Loups",
    /* emoji           */ "\xF0\x9F\x90\xBA",  // 🐺
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
    /* serialize_private*/ serialize_private_impl,
    /* tick            */ tick_impl,
};
