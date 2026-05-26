#include "most_likely.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Prompts — edit freely (FR).
// ---------------------------------------------------------------------------
static const char* PROMPTS[] = {
    "Qui est le plus susceptible de chanter au karaoke ?",
    "Qui est le plus susceptible d'oublier son anniversaire ?",
    "Qui est le plus susceptible de finir milliardaire ?",
    "Qui est le plus susceptible de devenir prof ?",
    "Qui est le plus susceptible de partir vivre a l'etranger ?",
    "Qui est le plus susceptible de finir le frigo a 3h du matin ?",
    "Qui est le plus susceptible de pleurer devant un Disney ?",
    "Qui est le plus susceptible d'envoyer un message a son ex ?",
    "Qui est le plus susceptible de se perdre dans son propre quartier ?",
    "Qui est le plus susceptible de rater son train ?",
};
static const int PROMPT_COUNT = sizeof(PROMPTS) / sizeof(PROMPTS[0]);

// ---------------------------------------------------------------------------
// Module-private state
// ---------------------------------------------------------------------------
namespace {

GamePhase phase       = GAME_PHASE_LOBBY;
int       current_idx = -1;
int       vote_counts[MAX_PLAYERS] = {0};

int slot_of(const Player* p) {
    if (!p) return -1;
    int idx = (int)(p - players);
    return (idx >= 0 && idx < MAX_PLAYERS) ? idx : -1;
}

void clear_round() {
    for (int i = 0; i < MAX_PLAYERS; i++) {
        vote_counts[i] = 0;
        players[i].answered = false;
        players[i].answer   = 0xFF;
    }
}

void start_round(int idx) {
    current_idx = idx;
    phase       = GAME_PHASE_PLAYING;
    clear_round();
}

bool all_voted() {
    int actives = 0, voted = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && players[i].name[0]) {
            actives++;
            if (players[i].answered) voted++;
        }
    }
    return actives > 0 && voted == actives;
}

void on_select_impl() {
    phase       = GAME_PHASE_LOBBY;
    current_idx = -1;
    clear_round();
}

void on_start_impl() {
    if (PROMPT_COUNT > 0) start_round(0);
}

void on_advance_impl() {
    if (phase == GAME_PHASE_LOBBY) {
        on_start_impl();
    } else if (phase == GAME_PHASE_PLAYING) {
        phase = GAME_PHASE_REVEAL;
    } else if (phase == GAME_PHASE_REVEAL) {
        if (current_idx + 1 < PROMPT_COUNT) start_round(current_idx + 1);
        else                                phase = GAME_PHASE_FINISHED;
    } else {  // FINISHED
        on_select_impl();
    }
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* /*p*/) {}

void on_player_leave_impl(Player* /*p*/) {
    if (phase == GAME_PHASE_PLAYING && all_voted()) phase = GAME_PHASE_REVEAL;
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING || p->answered) return;
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t || strcmp(t, "vote") != 0) return;
    uint32_t target_id = msg["target_id"] | 0u;
    Player* target = findPlayer(target_id);
    int tslot = slot_of(target);
    if (tslot < 0) return;
    p->answered = true;
    vote_counts[tslot]++;
    if (all_voted()) phase = GAME_PHASE_REVEAL;
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["total"] = PROMPT_COUNT;
    if (current_idx < 0) return;

    round["idx"] = current_idx;

    if (phase == GAME_PHASE_PLAYING || phase == GAME_PHASE_REVEAL) {
        round["prompt"] = PROMPTS[current_idx];
        int answered = 0;
        for (int i = 0; i < MAX_PLAYERS; i++)
            if (players[i].active && players[i].name[0] && players[i].answered) answered++;
        round["answered"] = answered;
    }
    if (phase == GAME_PHASE_REVEAL) {
        JsonArray va = round["votes"].to<JsonArray>();
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (players[i].name[0] && vote_counts[i] > 0) {
                JsonObject vo = va.add<JsonObject>();
                vo["name"]  = players[i].name;
                vo["count"] = vote_counts[i];
            }
        }
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING || phase == GAME_PHASE_REVEAL)
        snprintf(out, cap, "%d/%d", current_idx + 1, PROMPT_COUNT);
    else
        out[0] = '\0';
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game MOST_LIKELY_GAME = {
    /* id              */ "most_likely",
    /* name            */ "Le plus susceptible",
    /* emoji           */ "\xF0\x9F\x98\x88",  // 😈
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
