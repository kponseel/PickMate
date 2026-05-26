#include "would_rather.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Dilemmas — pairs of options (FR). Edit freely.
// ---------------------------------------------------------------------------
struct Pair { const char* a; const char* b; };

static const Pair PROMPTS[] = {
    {"Pouvoir voler",                       "Pouvoir lire dans les pensees"},
    {"Pizza pour le restant de tes jours",  "Plus jamais de fromage"},
    {"Vivre en ville",                      "Vivre a la campagne"},
    {"Trop chaud",                          "Trop froid"},
    {"Voir le futur",                       "Voir le passe"},
    {"Etre invisible",                      "Pouvoir devenir tres grand"},
    {"Vivre dans le passe",                 "Vivre dans le futur"},
    {"Voyager sans bagage",                 "Toujours en avoir trop"},
    {"Cuisiner pour 20",                    "Manger toujours seul"},
    {"Pouvoir parler toutes les langues",   "Pouvoir parler aux animaux"},
};
static const int PROMPT_COUNT = sizeof(PROMPTS) / sizeof(PROMPTS[0]);

#define ANS_A 0u
#define ANS_B 1u

// ---------------------------------------------------------------------------
namespace {

GamePhase phase       = GAME_PHASE_LOBBY;
int       current_idx = -1;

void clear_round() {
    for (int i = 0; i < MAX_PLAYERS; i++) {
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

int count_with(uint8_t which) {
    int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].name[0] && players[i].answered && players[i].answer == which) n++;
    return n;
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY;
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
    } else {
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
    if (!t || strcmp(t, "answer") != 0) return;
    int v = msg["value"] | -1;
    if (v != (int)ANS_A && v != (int)ANS_B) return;
    p->answered = true;
    p->answer   = (uint8_t)v;
    if (all_voted()) phase = GAME_PHASE_REVEAL;
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["total"] = PROMPT_COUNT;
    if (current_idx < 0) return;
    round["idx"] = current_idx;
    if (phase == GAME_PHASE_PLAYING || phase == GAME_PHASE_REVEAL) {
        round["a"] = PROMPTS[current_idx].a;
        round["b"] = PROMPTS[current_idx].b;
        int answered = 0;
        for (int i = 0; i < MAX_PLAYERS; i++)
            if (players[i].active && players[i].name[0] && players[i].answered) answered++;
        round["answered"] = answered;
    }
    if (phase == GAME_PHASE_REVEAL) {
        round["count_a"] = count_with(ANS_A);
        round["count_b"] = count_with(ANS_B);
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

const Game WOULD_RATHER_GAME = {
    /* id              */ "would_rather",
    /* name            */ "Tu preferes",
    /* emoji           */ "\xE2\x9A\x96\xEF\xB8\x8F",  // ⚖️
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
