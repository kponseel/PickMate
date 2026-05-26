#include "spyfall.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Location pool. Civilians all see the same location; the spy sees nothing.
// ---------------------------------------------------------------------------
static const char* LOCATIONS[] = {
    "Aeroport", "Restaurant", "Plage", "Casino", "Hopital",
    "Lycee", "Concert", "Banque", "Tour Eiffel", "Musee",
    "Cinema", "Gare", "Hotel", "Camping", "Salle de sport",
    "Centre commercial", "Boulangerie", "Stade", "Theatre", "Foret",
    "Chantier", "Bibliotheque", "Caserne de pompiers", "Sous-marin", "Vol spatial",
};
static const int LOCATION_COUNT = sizeof(LOCATIONS) / sizeof(LOCATIONS[0]);

// ---------------------------------------------------------------------------
namespace {

GamePhase phase = GAME_PHASE_LOBBY;

char current_location[32] = {0};
int  spy_slot   = -1;
int  vote_counts[MAX_PLAYERS] = {0};
// roles tracking for clean "joined mid-round" handling
uint8_t roles[MAX_PLAYERS] = {0};  // 0 = civilian, 1 = spy, 0xFF = spectator

int slot_of(const Player* p) {
    if (!p) return -1;
    int idx = (int)(p - players);
    return (idx >= 0 && idx < MAX_PLAYERS) ? idx : -1;
}

void clear_round() {
    current_location[0] = '\0';
    spy_slot = -1;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        roles[i]            = 0xFF;
        vote_counts[i]      = 0;
        players[i].answered = false;
        players[i].answer   = 0xFF;
    }
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY;
    clear_round();
}

void on_start_impl() {
    if (LOCATION_COUNT == 0) return;
    int active_slots[MAX_PLAYERS];
    int n_active = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0]) active_slots[n_active++] = i;
    if (n_active < 3) return;

    clear_round();
    const char* loc = LOCATIONS[random(LOCATION_COUNT)];
    strncpy(current_location, loc, sizeof(current_location) - 1);
    current_location[sizeof(current_location) - 1] = '\0';

    spy_slot = active_slots[random(n_active)];
    for (int i = 0; i < n_active; i++) roles[active_slots[i]] = 0;
    roles[spy_slot] = 1;

    phase = GAME_PHASE_PLAYING;
}

bool all_voted() {
    int actives = 0, voted = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && players[i].name[0] && roles[i] != 0xFF) {
            actives++;
            if (players[i].answered) voted++;
        }
    }
    return actives > 0 && voted == actives;
}

void on_advance_impl() {
    if      (phase == GAME_PHASE_LOBBY)    on_start_impl();
    else if (phase == GAME_PHASE_PLAYING)  phase = GAME_PHASE_REVEAL;
    else if (phase == GAME_PHASE_REVEAL)   on_start_impl();
    else                                   on_select_impl();
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* p) {
    int slot = slot_of(p);
    if (slot < 0) return;
    if (phase != GAME_PHASE_LOBBY && roles[slot] == 0xFF) {
        roles[slot] = 0;  // late joiner = civilian (can't retroactively be spy)
    }
}

void on_player_leave_impl(Player* /*p*/) {
    if (phase == GAME_PHASE_PLAYING && all_voted()) phase = GAME_PHASE_REVEAL;
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING || p->answered) return;
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t || strcmp(t, "vote") != 0) return;
    uint32_t target_id = msg["target_id"] | 0u;
    Player* tg = findPlayer(target_id);
    int tslot = slot_of(tg);
    if (tslot < 0 || roles[tslot] == 0xFF) return;
    p->answered = true;
    vote_counts[tslot]++;
    if (all_voted()) phase = GAME_PHASE_REVEAL;
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    if (phase == GAME_PHASE_LOBBY) return;
    if (phase == GAME_PHASE_PLAYING) {
        int answered = 0;
        for (int i = 0; i < MAX_PLAYERS; i++)
            if (players[i].active && players[i].name[0] && roles[i] != 0xFF && players[i].answered) answered++;
        round["answered"] = answered;
    }
    if (phase == GAME_PHASE_REVEAL) {
        round["location"] = current_location;
        JsonArray va = round["votes"].to<JsonArray>();
        int max_count = 0;
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (players[i].name[0] && roles[i] != 0xFF) {
                JsonObject vo = va.add<JsonObject>();
                vo["name"]  = players[i].name;
                vo["count"] = vote_counts[i];
                if (vote_counts[i] > max_count) max_count = vote_counts[i];
            }
        }
        bool spy_caught = false;
        if (spy_slot >= 0) {
            round["spy_name"] = players[spy_slot].name;
            spy_caught = (vote_counts[spy_slot] >= max_count && max_count > 0);
        }
        round["winner"] = spy_caught ? "civilians" : "spy";
    }
}

void serialize_private_impl(const Player* viewer, JsonObject out) {
    int slot = slot_of(viewer);
    if (slot < 0 || phase == GAME_PHASE_LOBBY) return;
    if (roles[slot] == 0xFF) { out["role"] = "spectator"; return; }
    if (roles[slot] == 1) {
        out["role"] = "spy";
        // No location for the spy — that's the whole point
    } else {
        out["role"]     = "civilian";
        out["location"] = current_location;
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING) {
        int answered = 0, actives = 0;
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (players[i].active && players[i].name[0] && roles[i] != 0xFF) {
                actives++;
                if (players[i].answered) answered++;
            }
        }
        snprintf(out, cap, "votes %d/%d", answered, actives);
    } else if (phase == GAME_PHASE_REVEAL) {
        snprintf(out, cap, "%s", current_location);
    } else {
        out[0] = '\0';
    }
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game SPYFALL_GAME = {
    /* id              */ "spyfall",
    /* name            */ "Spyfall",
    /* emoji           */ "\xF0\x9F\x95\xB6\xEF\xB8\x8F",  // 🕶️
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
