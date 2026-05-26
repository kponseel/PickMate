#include "bluff.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>
#include <ctype.h>

// ---------------------------------------------------------------------------
// Trivia bank — obscure-enough questions so people can plausibly bluff.
// ---------------------------------------------------------------------------
struct QA { const char* q; const char* a; };

static const QA QUESTIONS[] = {
    {"Quel est l'autre nom scientifique du paresseux ?",  "Bradype"},
    {"Comment s'appelle la peur des longs mots ?",        "Hippopotomonstrosesquippedaliophobie"},
    {"Quelle est la capitale du Kazakhstan ?",            "Astana"},
    {"En quelle annee a ete invente le post-it ?",        "1974"},
    {"Quel est l'animal national de l'Ecosse ?",          "La licorne"},
    {"Combien de coeurs a un poulpe ?",                   "Trois"},
    {"Quel mineral compose la perle ?",                   "Aragonite"},
    {"Quelle planete a la plus longue journee ?",         "Venus"},
    {"Quel est le plus long fleuve d'Europe ?",           "La Volga"},
    {"Quel mot Anglais a le plus de definitions ?",       "Set"},
    {"En quelle annee a ete fonde Google ?",              "1998"},
    {"Quel est le metal le plus cher au monde ?",         "Le rhodium"},
};
static const int QUESTION_COUNT = sizeof(QUESTIONS) / sizeof(QUESTIONS[0]);

#define MAX_SUBMISSION_LEN 31  // chars, excludes NUL
#define MAX_OPTIONS        (MAX_PLAYERS + 1)

// ---------------------------------------------------------------------------
namespace {

GamePhase phase     = GAME_PHASE_LOBBY;
int       q_idx     = -1;
int       step      = 0;   // 0 = submit fakes, 1 = vote
char      submissions[MAX_PLAYERS][MAX_SUBMISSION_LEN + 1] = {{0}};

struct Opt {
    char    text[MAX_SUBMISSION_LEN + 1];
    int8_t  owner;     // -1 = real answer, else player slot
};
Opt   options[MAX_OPTIONS];
int   option_count    = 0;
int   real_option_idx = -1;

int slot_of(const Player* p) {
    if (!p) return -1;
    int idx = (int)(p - players);
    return (idx >= 0 && idx < MAX_PLAYERS) ? idx : -1;
}

void clear_step_flags() {
    for (int i = 0; i < MAX_PLAYERS; i++) {
        players[i].answered = false;
        players[i].answer   = 0xFF;
    }
}

void clear_full_round() {
    clear_step_flags();
    for (int i = 0; i < MAX_PLAYERS; i++) submissions[i][0] = '\0';
    option_count    = 0;
    real_option_idx = -1;
}

bool ci_equal(const char* a, const char* b) {
    while (*a && *b) {
        if (tolower((unsigned char)*a) != tolower((unsigned char)*b)) return false;
        a++; b++;
    }
    return *a == '\0' && *b == '\0';
}

void start_round(int idx) {
    q_idx = idx;
    step  = 0;
    phase = GAME_PHASE_PLAYING;
    clear_full_round();
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY;
    q_idx = -1; step = 0;
    clear_full_round();
    for (int i = 0; i < MAX_PLAYERS; i++) players[i].score = 0;
}

void on_start_impl() { if (QUESTION_COUNT > 0) start_round(0); }

bool all_active_acted() {
    int actives = 0, acted = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && players[i].name[0]) {
            actives++;
            if (players[i].answered) acted++;
        }
    }
    return actives > 0 && acted == actives;
}

void shuffle_and_seal_options() {
    // Collect non-empty submissions whose text differs from the real answer
    // (case-insensitive). If a player's fake happens to match the truth,
    // drop it — they get auto-credit at scoring time.
    option_count = 0;
    const char* real = QUESTIONS[q_idx].a;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (!players[i].active || !players[i].name[0]) continue;
        if (submissions[i][0] == '\0') continue;
        if (ci_equal(submissions[i], real)) continue;
        if (option_count >= MAX_OPTIONS - 1) break;  // keep room for real
        strncpy(options[option_count].text, submissions[i], sizeof(options[0].text) - 1);
        options[option_count].text[sizeof(options[0].text) - 1] = '\0';
        options[option_count].owner = (int8_t)i;
        option_count++;
    }
    // Append the real answer
    strncpy(options[option_count].text, real, sizeof(options[0].text) - 1);
    options[option_count].text[sizeof(options[0].text) - 1] = '\0';
    options[option_count].owner = -1;
    option_count++;
    // Fisher-Yates shuffle
    for (int i = option_count - 1; i > 0; i--) {
        int j = random(i + 1);
        Opt tmp = options[i]; options[i] = options[j]; options[j] = tmp;
    }
    // Find where the real answer ended up
    real_option_idx = -1;
    for (int i = 0; i < option_count; i++) if (options[i].owner == -1) real_option_idx = i;
}

void apply_scoring() {
    if (real_option_idx < 0) return;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (!players[i].active || !players[i].name[0]) continue;
        if (!players[i].answered) continue;
        uint8_t pick = players[i].answer;
        if (pick >= option_count) continue;
        if ((int)pick == real_option_idx) {
            players[i].score += 500;
        } else {
            int owner_slot = options[pick].owner;
            if (owner_slot >= 0 && owner_slot < MAX_PLAYERS && owner_slot != i) {
                players[owner_slot].score += 250;
            }
        }
    }
}

void on_advance_impl() {
    if (phase == GAME_PHASE_LOBBY) { on_start_impl(); return; }
    if (phase == GAME_PHASE_PLAYING && step == 0) {
        shuffle_and_seal_options();
        step = 1;
        clear_step_flags();
        return;
    }
    if (phase == GAME_PHASE_PLAYING && step == 1) {
        apply_scoring();
        phase = GAME_PHASE_REVEAL;
        return;
    }
    if (phase == GAME_PHASE_REVEAL) {
        if (q_idx + 1 < QUESTION_COUNT) { start_round(q_idx + 1); return; }
        phase = GAME_PHASE_FINISHED;
        return;
    }
    // FINISHED
    on_select_impl();
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* /*p*/) {}
void on_player_leave_impl(Player* /*p*/) {
    if (phase == GAME_PHASE_PLAYING && all_active_acted()) {
        on_advance_impl();   // auto-progress (submit→vote, or vote→reveal)
    }
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING) return;
    int slot = slot_of(p);
    if (slot < 0) return;
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t) return;
    if (step == 0 && strcmp(t, "submit") == 0 && !p->answered) {
        const char* text = msg["text"] | "";
        // Trim leading whitespace
        while (*text == ' ' || *text == '\t') text++;
        if (*text == '\0') return;
        strncpy(submissions[slot], text, MAX_SUBMISSION_LEN);
        submissions[slot][MAX_SUBMISSION_LEN] = '\0';
        // Trim trailing whitespace
        for (int i = strlen(submissions[slot]) - 1; i >= 0 && (submissions[slot][i] == ' ' || submissions[slot][i] == '\t'); i--)
            submissions[slot][i] = '\0';
        if (submissions[slot][0] == '\0') return;
        p->answered = true;
        if (all_active_acted()) on_advance_impl();
        return;
    }
    if (step == 1 && strcmp(t, "vote") == 0 && !p->answered) {
        int opt = msg["option"] | -1;
        if (opt < 0 || opt >= option_count) return;
        // Can't vote for your own fake
        if (options[opt].owner == slot) return;
        p->answered = true;
        p->answer   = (uint8_t)opt;
        if (all_active_acted()) on_advance_impl();
    }
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["total"] = QUESTION_COUNT;
    if (q_idx < 0) return;
    round["idx"]   = q_idx;
    round["q"]     = QUESTIONS[q_idx].q;
    round["step"]  = (step == 0) ? "submit" : (step == 1 ? "vote" : "reveal");

    int actives = 0, acted = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && players[i].name[0]) {
            actives++;
            if (players[i].answered) acted++;
        }
    }

    if (phase == GAME_PHASE_PLAYING) {
        round["answered"] = acted;
        round["players_active"] = actives;
        if (step == 1) {
            JsonArray opts = round["options"].to<JsonArray>();
            for (int i = 0; i < option_count; i++) opts.add(options[i].text);
        }
    }
    if (phase == GAME_PHASE_REVEAL) {
        round["real_answer"]     = QUESTIONS[q_idx].a;
        round["real_option_idx"] = real_option_idx;
        JsonArray opts = round["options"].to<JsonArray>();
        for (int i = 0; i < option_count; i++) {
            JsonObject o = opts.add<JsonObject>();
            o["text"]  = options[i].text;
            o["real"]  = (i == real_option_idx);
            int owner = options[i].owner;
            if (owner >= 0 && owner < MAX_PLAYERS && players[owner].name[0])
                o["owner"] = players[owner].name;
        }
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING)
        snprintf(out, cap, "Q%d/%d %s", q_idx + 1, QUESTION_COUNT, step == 0 ? "ecrit" : "vote");
    else if (phase == GAME_PHASE_REVEAL)
        snprintf(out, cap, "reveal %d/%d", q_idx + 1, QUESTION_COUNT);
    else out[0] = '\0';
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game BLUFF_GAME = {
    /* id              */ "bluff",
    /* name            */ "Le Bluff",
    /* emoji           */ "\xF0\x9F\xA4\xA5",  // 🤥
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
