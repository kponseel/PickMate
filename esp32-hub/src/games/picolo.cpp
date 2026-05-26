#include "picolo.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Prompts. {p1}, {p2}, {p3} are replaced by random distinct player names.
// Roughly ordered from soft to spicy.
// ---------------------------------------------------------------------------
static const char* PROMPTS[] = {
    "{p1} commence : raconte ta journee en 15 secondes",
    "{p1} et {p2} : faites un high-five aussi maladroit que possible",
    "Tout le monde sauf {p1} bois une gorgee",
    "{p1} : nomme 3 joueurs qui doivent boire",
    "{p1} et {p2} echangent de place",
    "{p1} mime un metier, les autres devinent",
    "Les gauchers boivent. (Pas de gauchers ? {p1} bois)",
    "{p1} chante 5 secondes d'une chanson, {p2} continue",
    "Categorie : marques de cereales. Tour de table, premier·e qui rate bois",
    "{p1} regarde {p2} sans rire pendant 10 secondes",
    "Tout le monde leve son verre — {p1} fait le toast",
    "{p1} et {p2} : echangez un compliment honnete",
    "{p1} : revele un detail sur toi qu'aucun ici ne sait",
    "Cul-sec collectif sur 3-2-1 — chacun ce qu'il/elle veut",
    "{p1} pose une question, {p2} repond en moins de 3 sec",
    "Sondage : sur une echelle de 1 a 10, comment va {p1} ce soir ?",
    "{p1} et {p3} echangent leur pseudo pour les 3 prochains tours",
    "{p1} : explique a {p2} le sens de la vie (30 sec max)",
};
static const int PROMPT_COUNT = sizeof(PROMPTS) / sizeof(PROMPTS[0]);

#define BUF_LEN 200

namespace {

GamePhase phase = GAME_PHASE_LOBBY;
int       prompt_idx = -1;
char      rendered[BUF_LEN] = {0};
uint32_t  round_n = 0;

void replace_token(char* out, size_t cap, const char* in, const char* token, const char* repl) {
    if (cap == 0) return;
    out[0] = '\0';
    size_t tok_len = strlen(token);
    size_t out_len = 0;
    const char* p = in;
    while (*p && out_len < cap - 1) {
        if (strncmp(p, token, tok_len) == 0) {
            size_t r = strlen(repl);
            if (out_len + r >= cap - 1) r = cap - 1 - out_len;
            memcpy(out + out_len, repl, r); out_len += r;
            p += tok_len;
        } else {
            out[out_len++] = *p++;
        }
    }
    out[out_len] = '\0';
}

void render_prompt(int idx) {
    if (idx < 0 || idx >= PROMPT_COUNT) { rendered[0] = '\0'; return; }
    // Gather active player names
    const char* names[MAX_PLAYERS]; int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0]) names[n++] = players[i].name;
    if (n == 0) { strncpy(rendered, PROMPTS[idx], BUF_LEN - 1); rendered[BUF_LEN - 1] = '\0'; return; }

    const char* p1 = names[random(n)];
    const char* p2 = (n >= 2) ? names[random(n)] : p1;
    int safety = 0;
    while (p2 == p1 && n >= 2 && safety++ < 8) p2 = names[random(n)];
    const char* p3 = (n >= 3) ? names[random(n)] : p2;
    safety = 0;
    while ((p3 == p1 || p3 == p2) && n >= 3 && safety++ < 8) p3 = names[random(n)];

    char tmp1[BUF_LEN]; char tmp2[BUF_LEN];
    replace_token(tmp1,    sizeof(tmp1),    PROMPTS[idx], "{p1}", p1);
    replace_token(tmp2,    sizeof(tmp2),    tmp1,         "{p2}", p2);
    replace_token(rendered, BUF_LEN,        tmp2,         "{p3}", p3);
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY; prompt_idx = -1; round_n = 0;
    rendered[0] = '\0';
}

void on_start_impl() {
    if (PROMPT_COUNT == 0) return;
    prompt_idx = 0;
    render_prompt(prompt_idx);
    phase = GAME_PHASE_PLAYING;
    round_n = 1;
}

void on_advance_impl() {
    if      (phase == GAME_PHASE_LOBBY)  on_start_impl();
    else if (phase == GAME_PHASE_PLAYING) {
        prompt_idx++;
        if (prompt_idx >= PROMPT_COUNT) { phase = GAME_PHASE_FINISHED; return; }
        render_prompt(prompt_idx);
        round_n++;
    }
    else if (phase == GAME_PHASE_FINISHED) on_select_impl();
    else on_select_impl();
}

void on_reset_impl() { on_select_impl(); }
void on_player_join_impl(Player* /*p*/) {}
void on_player_leave_impl(Player* /*p*/) {}
void on_message_impl(Player* /*p*/, const JsonDocument& /*msg*/) {}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["round_n"] = round_n;
    round["total"]   = PROMPT_COUNT;
    if (phase == GAME_PHASE_PLAYING) {
        round["idx"]    = prompt_idx;
        round["prompt"] = rendered;
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING) snprintf(out, cap, "%d/%d", prompt_idx + 1, PROMPT_COUNT);
    else out[0] = '\0';
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game PICOLO_GAME = {
    /* id              */ "picolo",
    /* name            */ "Picolo",
    /* emoji           */ "\xF0\x9F\x8D\xBB",  // 🍻
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
