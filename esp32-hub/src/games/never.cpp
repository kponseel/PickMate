#include "never.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Prompts — "Je n'ai jamais..." (edit freely).
// ---------------------------------------------------------------------------
static const char* PROMPTS[] = {
    "Je n'ai jamais fume une cigarette",
    "Je n'ai jamais menti a un parent",
    "Je n'ai jamais sauté un cours",
    "Je n'ai jamais chante en public sobre",
    "Je n'ai jamais oublie un anniversaire important",
    "Je n'ai jamais envoye un message a la mauvaise personne",
    "Je n'ai jamais pleure devant un film d'animation",
    "Je n'ai jamais dansé seul devant un miroir",
    "Je n'ai jamais menti sur mon age",
    "Je n'ai jamais fait semblant d'être malade pour eviter quelque chose",
    "Je n'ai jamais googlé mon propre nom",
};
static const int PROMPT_COUNT = sizeof(PROMPTS) / sizeof(PROMPTS[0]);

// Answer encoding stored in Player.answer:
//   0 = "J'ai deja" (have done it)
//   1 = "Jamais"   (never)
#define ANS_HAVE  0u
#define ANS_NEVER 1u

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

int count_with_answer(uint8_t which) {
    int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].name[0] && players[i].answered && players[i].answer == which) n++;
    return n;
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
    if (v != (int)ANS_HAVE && v != (int)ANS_NEVER) return;
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
        round["prompt"] = PROMPTS[current_idx];
        int answered = 0;
        for (int i = 0; i < MAX_PLAYERS; i++)
            if (players[i].active && players[i].name[0] && players[i].answered) answered++;
        round["answered"] = answered;
    }
    if (phase == GAME_PHASE_REVEAL) {
        round["have"]  = count_with_answer(ANS_HAVE);
        round["never"] = count_with_answer(ANS_NEVER);
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

const Game NEVER_GAME = {
    /* id              */ "never",
    /* name            */ "Je n'ai jamais",
    /* emoji           */ "\xF0\x9F\x99\x8A",  // 🙊
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
