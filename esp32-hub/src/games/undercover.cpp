#include "undercover.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Word pairs — civilian / undercover. The two should be related but distinct.
// ---------------------------------------------------------------------------
struct WordPair { const char* civ; const char* uc; };

static const WordPair PAIRS[] = {
    {"chien",          "chat"},
    {"pomme",          "poire"},
    {"plage",          "piscine"},
    {"voiture",        "moto"},
    {"hiver",          "automne"},
    {"baguette",       "croissant"},
    {"cafe",           "the"},
    {"musique",        "podcast"},
    {"livre",          "film"},
    {"foret",          "montagne"},
    {"violon",         "guitare"},
    {"velo",           "trottinette"},
    {"crayon",         "stylo"},
    {"oiseau",         "chauve-souris"},
    {"basketball",     "volleyball"},
    {"camion",         "bus"},
    {"ours",           "loup"},
    {"requin",         "dauphin"},
    {"sushi",          "pizza"},
    {"jeux video",     "jeux de societe"},
    {"chocolat",       "caramel"},
    {"avion",          "helicoptere"},
    {"pluie",          "neige"},
    {"professeur",     "etudiant"},
    {"telephone",      "tablette"},
};
static const int PAIR_COUNT = sizeof(PAIRS) / sizeof(PAIRS[0]);

// ---------------------------------------------------------------------------
namespace {

GamePhase phase = GAME_PHASE_LOBBY;

char word_civ[24] = {0};
char word_uc[24]  = {0};

// 0 = civilian, 1 = undercover, 0xFF = not playing this round (left between rounds)
uint8_t roles[MAX_PLAYERS] = {0};
int     vote_counts[MAX_PLAYERS] = {0};

int slot_of(const Player* p) {
    if (!p) return -1;
    int idx = (int)(p - players);
    return (idx >= 0 && idx < MAX_PLAYERS) ? idx : -1;
}

void clear_round() {
    for (int i = 0; i < MAX_PLAYERS; i++) {
        roles[i]            = 0xFF;
        vote_counts[i]      = 0;
        players[i].answered = false;
        players[i].answer   = 0xFF;
    }
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY;
    word_civ[0] = '\0';
    word_uc[0]  = '\0';
    clear_round();
}

void on_start_impl() {
    if (PAIR_COUNT == 0) return;

    int n_active = 0;
    int active_slots[MAX_PLAYERS];
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && players[i].name[0]) active_slots[n_active++] = i;
    }
    if (n_active < 3) return;  // not enough players

    clear_round();

    // Pick a random pair + 50/50 swap so the "undercover" isn't always the
    // alphabetically-later word.
    int pair_idx = random(PAIR_COUNT);
    const char* w_majority;
    const char* w_minority;
    if (random(2) == 0) { w_majority = PAIRS[pair_idx].civ; w_minority = PAIRS[pair_idx].uc; }
    else                { w_majority = PAIRS[pair_idx].uc;  w_minority = PAIRS[pair_idx].civ; }
    strncpy(word_civ, w_majority, sizeof(word_civ) - 1); word_civ[sizeof(word_civ) - 1] = '\0';
    strncpy(word_uc,  w_minority, sizeof(word_uc)  - 1); word_uc[sizeof(word_uc)  - 1] = '\0';

    // Mark everyone civilian, then promote 1 (or 2 if >=5 players) to undercover.
    int n_uc = (n_active >= 5) ? 2 : 1;
    for (int i = 0; i < n_active; i++) roles[active_slots[i]] = 0;
    for (int picked = 0; picked < n_uc; ) {
        int s = active_slots[random(n_active)];
        if (roles[s] != 1) { roles[s] = 1; picked++; }
    }
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
    else if (phase == GAME_PHASE_REVEAL)   on_start_impl();   // next round
    else                                   on_select_impl();
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* p) {
    int slot = slot_of(p);
    if (slot < 0) return;
    if (phase != GAME_PHASE_LOBBY && roles[slot] == 0xFF) {
        // Joined mid-round → mark them civilian for the remaining round
        // (no fair way to give them the undercover word retroactively).
        roles[slot] = 0;
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
        JsonArray ucs = round["undercovers"].to<JsonArray>();
        bool civilians_win = true;
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (players[i].name[0] && roles[i] == 1) {
                ucs.add(players[i].name);
                if (vote_counts[i] < max_count || max_count == 0) civilians_win = false;
            }
        }
        round["word_civ"] = word_civ;
        round["word_uc"]  = word_uc;
        round["winner"]   = civilians_win ? "civilians" : "undercover";
    }
}

void serialize_private_impl(const Player* viewer, JsonObject out) {
    int slot = slot_of(viewer);
    if (slot < 0 || phase == GAME_PHASE_LOBBY) return;
    if (roles[slot] == 0xFF) {  // spectator (joined mid-round before promotion)
        out["role"] = "spectator";
        return;
    }
    out["role"] = (roles[slot] == 1) ? "undercover" : "civilian";
    out["word"] = (roles[slot] == 1) ? word_uc : word_civ;
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
        snprintf(out, cap, "reveal");
    } else {
        out[0] = '\0';
    }
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game UNDERCOVER_GAME = {
    /* id              */ "undercover",
    /* name            */ "Undercover",
    /* emoji           */ "\xF0\x9F\x95\xB5\xEF\xB8\x8F",  // 🕵️
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
