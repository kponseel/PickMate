#include "quips.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Prompts — the funnier and more open-ended, the better.
// ---------------------------------------------------------------------------
static const char* PROMPTS[] = {
    "La pire excuse possible pour annuler un rendez-vous",
    "Le slogan d'un fast-food trop honnete",
    "Une devise de famille genante",
    "La replique d'un mauvais film d'action",
    "Le pire surnom pour un chat",
    "Le titre d'une autobiographie de ton voisin",
    "Une chanson qui passerait dans un ascenseur",
    "Le pire conseil que tu as recu",
    "Une publicite des annees 80",
    "Une regle de jeu de societe absurde",
    "Le nom d'un parfum vraiment improbable",
    "Le motto secret d'un super-mechant timide",
    "Un slogan pour une marque de chaussettes",
    "Une excuse pour ne pas faire la vaisselle",
    "Le titre d'un film qui ferait fuir au cinema",
    "Un cri de guerre pour des enfants en colo",
    "La premiere phrase d'un journal apocalyptique",
    "Le nom d'un groupe de musique improbable",
    "La devise d'une ecole de cuisine en deroute",
    "Le titre d'une theorie du complot ridicule",
    "Une phrase entendue dans une pub pharmaceutique",
    "Le pire compliment a faire en speed dating",
    "Le nom d'un nouveau parfum Yankee Candle",
    "Une excuse de retard pour un Premier Ministre",
    "La premiere ligne d'un poeme ecrit par une IA defaillante",
};
static const int PROMPT_COUNT = sizeof(PROMPTS) / sizeof(PROMPTS[0]);

#define ANS_LEN 47   // chars (matches MAX_SUBMISSION-ish)

namespace {

GamePhase phase   = GAME_PHASE_LOBBY;
int       prompt_idx = -1;
int       contestant_a = -1;
int       contestant_b = -1;
char      answer_a[ANS_LEN + 1] = {0};
char      answer_b[ANS_LEN + 1] = {0};
int       step    = 0;       // 0 = submit, 1 = vote
int       votes_a = 0, votes_b = 0;
uint32_t  round_n = 0;

int slot_of(const Player* p) {
    if (!p) return -1;
    int idx = (int)(p - players);
    return (idx >= 0 && idx < MAX_PLAYERS) ? idx : -1;
}

bool is_contestant(int slot) {
    return slot >= 0 && (slot == contestant_a || slot == contestant_b);
}

void clear_round() {
    for (int i = 0; i < MAX_PLAYERS; i++) { players[i].answered = false; players[i].answer = 0xFF; }
    answer_a[0] = '\0'; answer_b[0] = '\0';
    votes_a = 0; votes_b = 0;
}

void pick_contestants() {
    int actives[MAX_PLAYERS]; int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0]) actives[n++] = i;
    if (n < 2) { contestant_a = -1; contestant_b = -1; return; }
    int i = random(n);
    int j = random(n - 1);
    if (j >= i) j++;
    contestant_a = actives[i];
    contestant_b = actives[j];
}

void start_round() {
    if (PROMPT_COUNT == 0) return;
    prompt_idx = random(PROMPT_COUNT);
    pick_contestants();
    if (contestant_a < 0) { phase = GAME_PHASE_LOBBY; return; }
    clear_round();
    step = 0;
    phase = GAME_PHASE_PLAYING;
    round_n++;
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY; prompt_idx = -1;
    contestant_a = contestant_b = -1; step = 0; round_n = 0;
    clear_round();
    for (int i = 0; i < MAX_PLAYERS; i++) players[i].score = 0;
}

void on_start_impl() { start_round(); }

bool both_submitted() { return answer_a[0] && answer_b[0]; }

bool all_voters_voted() {
    int v_total = 0, v_done = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (!players[i].active || !players[i].name[0]) continue;
        if (is_contestant(i)) continue;
        v_total++;
        if (players[i].answered) v_done++;
    }
    return v_total > 0 && v_done == v_total;
}

void award_winner() {
    if (votes_a == votes_b) {
        // Tie — both win small
        if (contestant_a >= 0) players[contestant_a].score += 100;
        if (contestant_b >= 0) players[contestant_b].score += 100;
    } else if (votes_a > votes_b) {
        if (contestant_a >= 0) players[contestant_a].score += 300;
    } else {
        if (contestant_b >= 0) players[contestant_b].score += 300;
    }
}

void on_advance_impl() {
    if (phase == GAME_PHASE_LOBBY) { on_start_impl(); return; }
    if (phase == GAME_PHASE_PLAYING && step == 0) {
        // Move to vote step, even if a contestant didn't submit (timeout/skip)
        if (!answer_a[0]) strncpy(answer_a, "(pas de reponse)", ANS_LEN);
        if (!answer_b[0]) strncpy(answer_b, "(pas de reponse)", ANS_LEN);
        for (int i = 0; i < MAX_PLAYERS; i++) { players[i].answered = false; players[i].answer = 0xFF; }
        step = 1;
        return;
    }
    if (phase == GAME_PHASE_PLAYING && step == 1) {
        award_winner();
        phase = GAME_PHASE_REVEAL;
        return;
    }
    if (phase == GAME_PHASE_REVEAL) { start_round(); return; }
    on_select_impl();
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* /*p*/) {}

void on_player_leave_impl(Player* p) {
    int slot = slot_of(p);
    if (phase != GAME_PHASE_PLAYING) return;
    if (slot == contestant_a || slot == contestant_b) {
        // Contestant left mid-round → skip to vote (or reveal if also empty)
        if (step == 0) on_advance_impl();
    } else if (step == 1 && all_voters_voted()) {
        on_advance_impl();
    }
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING) return;
    int slot = slot_of(p);
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t) return;
    if (step == 0 && strcmp(t, "submit") == 0 && is_contestant(slot)) {
        const char* text = msg["text"] | "";
        while (*text == ' ' || *text == '\t') text++;
        if (*text == '\0') return;
        char* dst = (slot == contestant_a) ? answer_a : answer_b;
        if (dst[0]) return;  // already submitted, ignore duplicate
        strncpy(dst, text, ANS_LEN); dst[ANS_LEN] = '\0';
        for (int i = strlen(dst) - 1; i >= 0 && (dst[i] == ' ' || dst[i] == '\t'); i--) dst[i] = '\0';
        if (both_submitted()) on_advance_impl();
        return;
    }
    if (step == 1 && strcmp(t, "vote") == 0 && !is_contestant(slot) && !p->answered) {
        int v = msg["value"] | -1;  // 0 = a, 1 = b
        if (v == 0)      { votes_a++; p->answered = true; p->answer = 0; }
        else if (v == 1) { votes_b++; p->answered = true; p->answer = 1; }
        else return;
        if (all_voters_voted()) on_advance_impl();
    }
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["round_n"] = round_n;
    if (phase == GAME_PHASE_LOBBY) return;
    round["prompt"] = (prompt_idx >= 0) ? PROMPTS[prompt_idx] : "";
    if (contestant_a >= 0) {
        round["contestant_a_id"]   = players[contestant_a].clientId;
        round["contestant_a_name"] = players[contestant_a].name;
    }
    if (contestant_b >= 0) {
        round["contestant_b_id"]   = players[contestant_b].clientId;
        round["contestant_b_name"] = players[contestant_b].name;
    }
    round["step"] = (step == 0) ? "submit" : "vote";
    if (phase == GAME_PHASE_PLAYING && step == 0) {
        int submitted = 0;
        if (answer_a[0]) submitted++;
        if (answer_b[0]) submitted++;
        round["submitted"]   = submitted;
        round["submitted_a"] = answer_a[0] != '\0';
        round["submitted_b"] = answer_b[0] != '\0';
    }
    if (phase == GAME_PHASE_PLAYING && step == 1) {
        round["answer_a"] = answer_a;
        round["answer_b"] = answer_b;
        int v_total = 0, v_done = 0;
        for (int i = 0; i < MAX_PLAYERS; i++) {
            if (!players[i].active || !players[i].name[0]) continue;
            if (is_contestant(i)) continue;
            v_total++;
            if (players[i].answered) v_done++;
        }
        round["voted"]   = v_done;
        round["voters"]  = v_total;
    }
    if (phase == GAME_PHASE_REVEAL) {
        round["answer_a"] = answer_a;
        round["answer_b"] = answer_b;
        round["votes_a"]  = votes_a;
        round["votes_b"]  = votes_b;
        const char* winner = (votes_a == votes_b) ? "tie" : (votes_a > votes_b ? "a" : "b");
        round["winner"]   = winner;
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING && contestant_a >= 0 && contestant_b >= 0)
        snprintf(out, cap, "%s vs %s", players[contestant_a].name, players[contestant_b].name);
    else if (phase == GAME_PHASE_REVEAL)
        snprintf(out, cap, "round %u", (unsigned)round_n);
    else out[0] = '\0';
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game QUIPS_GAME = {
    /* id              */ "quips",
    /* name            */ "Vannes",
    /* emoji           */ "\xF0\x9F\x8E\xA4",  // 🎤
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
