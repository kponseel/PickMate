#include "quiz.h"

#include <Arduino.h>
#include <string.h>
#include <stdio.h>

// ---------------------------------------------------------------------------
// Quiz content — edit freely. (idx of the correct option = 0..3)
// ---------------------------------------------------------------------------
struct Question {
    const char* text;
    const char* options[4];
    uint8_t     correct;
};

static const Question QUESTIONS[] = {
    {"Quelle est la capitale de la France ?",                 {"Lyon", "Paris", "Marseille", "Nice"},                      1},
    {"Combien font 7 x 8 ?",                                  {"54", "56", "64", "48"},                                    1},
    {"Quel gaz les plantes absorbent-elles ?",                {"Oxygene", "Azote", "CO2", "Helium"},                       2},
    {"Quel est le plus grand ocean ?",                        {"Atlantique", "Indien", "Arctique", "Pacifique"},           3},
    {"Combien de bits dans un octet ?",                       {"4", "8", "16", "32"},                                      1},
    {"Quelle est la capitale de l'Espagne ?",                 {"Lisbonne", "Madrid", "Athenes", "Rome"},                   1},
    {"Quelle est la plus grosse planete du systeme solaire ?",{"Mars", "Saturne", "Jupiter", "Neptune"},                   2},
    {"Combien y a-t-il de continents ?",                      {"4", "5", "6", "7"},                                        3},
    {"Quel animal a le plus long cou ?",                      {"Autruche", "Lama", "Girafe", "Flamant"},                   2},
    {"Qui a peint la Joconde ?",                              {"Michel-Ange", "Raphael", "Leonard de Vinci", "Picasso"},   2},
    {"Comment s'appelle un bebe chien ?",                     {"Chaton", "Chiot", "Faon", "Poulain"},                      1},
    {"Quel est le plus grand desert chaud du monde ?",        {"Gobi", "Kalahari", "Atacama", "Sahara"},                   3},
    {"En quelle annee est tombe le Mur de Berlin ?",          {"1985", "1989", "1991", "1993"},                            1},
    {"Combien de touches a un piano classique ?",             {"76", "82", "88", "96"},                                    2},
    {"Quelle est la monnaie du Japon ?",                      {"Won", "Yuan", "Yen", "Baht"},                              2},
    {"Quel est le plus haut sommet du monde ?",               {"K2", "Mont Blanc", "Everest", "Kilimandjaro"},             2},
    {"Quel sport pratique Roger Federer ?",                   {"Golf", "Tennis", "Ski", "Basket"},                         1},
    {"Combien de joueurs dans une equipe de foot ?",          {"9", "10", "11", "12"},                                     2},
    {"Quelle est la capitale de l'Australie ?",               {"Sydney", "Melbourne", "Canberra", "Perth"},                2},
    {"Quel auteur a ecrit 'Les Miserables' ?",                {"Zola", "Hugo", "Balzac", "Dumas"},                         1},
    {"Combien d'os dans le corps humain adulte ?",            {"186", "206", "256", "306"},                                1},
    {"Quelle planete a des anneaux celebres ?",               {"Mars", "Jupiter", "Saturne", "Uranus"},                    2},
    {"Quel est le pays le plus peuple au monde ?",            {"Chine", "Inde", "USA", "Indonesie"},                       1},
    {"Combien de cotes a un hexagone ?",                      {"5", "6", "7", "8"},                                        1},
    {"Combien de cordes sur une guitare standard ?",          {"4", "5", "6", "7"},                                        2},
};
static const int      QUESTION_COUNT   = sizeof(QUESTIONS) / sizeof(QUESTIONS[0]);
static const uint32_t QUESTION_TIME_MS = 20000UL;

// ---------------------------------------------------------------------------
// Module-private state (all access serialised by the core's game mutex)
// ---------------------------------------------------------------------------
namespace {

GamePhase phase             = GAME_PHASE_LOBBY;
int       current_q         = -1;
uint32_t  question_start_ms = 0;

bool all_answered() {
    int actives = 0, answered = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && players[i].name[0]) {
            actives++;
            if (players[i].answered) answered++;
        }
    }
    return actives > 0 && answered == actives;
}

void start_question(int idx) {
    current_q         = idx;
    phase             = GAME_PHASE_PLAYING;
    question_start_ms = millis();
    for (int i = 0; i < MAX_PLAYERS; i++) {
        players[i].answered = false;
        players[i].answer   = 0xFF;
    }
}

void do_reveal() {
    if (phase != GAME_PHASE_PLAYING) return;  // idempotent
    uint8_t correct = QUESTIONS[current_q].correct;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        Player& p = players[i];
        if (p.active && p.name[0] && p.answered && p.answer == correct) {
            float frac = 1.0f - (float)p.answerMs / (float)QUESTION_TIME_MS;
            if (frac < 0) frac = 0;
            p.score += 500 + (uint32_t)(500.0f * frac);
        }
    }
    phase = GAME_PHASE_REVEAL;
}

void on_select_impl() {
    phase     = GAME_PHASE_LOBBY;
    current_q = -1;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        players[i].score    = 0;
        players[i].answered = false;
        players[i].answer   = 0xFF;
    }
}

void on_start_impl() {
    if (QUESTION_COUNT > 0) start_question(0);
}

void on_advance_impl() {
    if (phase == GAME_PHASE_LOBBY) {
        on_start_impl();
    } else if (phase == GAME_PHASE_PLAYING) {
        do_reveal();
    } else if (phase == GAME_PHASE_REVEAL) {
        if (current_q + 1 < QUESTION_COUNT) start_question(current_q + 1);
        else                                phase = GAME_PHASE_FINISHED;
    } else {  // FINISHED
        on_select_impl();
    }
}

void on_reset_impl() {
    on_select_impl();  // same effect
}

void on_player_join_impl(Player* /*p*/) {
    // Nothing quiz-specific to do on a fresh join: scores and answered are
    // already zeroed for new players, and reconnecting ones keep their score.
}

void on_player_leave_impl(Player* /*p*/) {
    // If a still-thinking player leaves mid-question and they were the last
    // missing answer, close the round.
    if (phase == GAME_PHASE_PLAYING && all_answered()) do_reveal();
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p) return;
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t || strcmp(t, "answer") != 0) return;
    if (phase != GAME_PHASE_PLAYING || p->answered) return;
    int choice = msg["choice"] | -1;
    if (choice < 0 || choice > 3) return;
    p->answered = true;
    p->answer   = (uint8_t)choice;
    p->answerMs = millis() - question_start_ms;
    if (all_answered()) do_reveal();
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["total"] = QUESTION_COUNT;
    if (current_q < 0) return;

    const Question& q = QUESTIONS[current_q];
    round["idx"] = current_q;
    if (phase == GAME_PHASE_PLAYING || phase == GAME_PHASE_REVEAL) {
        round["q"] = q.text;
        JsonArray opts = round["options"].to<JsonArray>();
        for (int i = 0; i < 4; i++) opts.add(q.options[i]);
    }
    if (phase == GAME_PHASE_PLAYING) {
        uint32_t elapsed = millis() - question_start_ms;
        round["time_left_ms"] = elapsed >= QUESTION_TIME_MS ? 0 : (long)(QUESTION_TIME_MS - elapsed);
        int answered = 0;
        for (int i = 0; i < MAX_PLAYERS; i++)
            if (players[i].active && players[i].name[0] && players[i].answered) answered++;
        round["answered"] = answered;
    } else if (phase == GAME_PHASE_REVEAL) {
        round["correct"] = q.correct;
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING || phase == GAME_PHASE_REVEAL) {
        snprintf(out, cap, "%d/%d", current_q + 1, QUESTION_COUNT);
    } else {
        out[0] = '\0';
    }
}

bool tick_impl(uint32_t now_ms) {
    if (phase == GAME_PHASE_PLAYING && (now_ms - question_start_ms) > QUESTION_TIME_MS) {
        do_reveal();
        return true;  // phase transition — please broadcast
    }
    return false;
}

}  // anonymous namespace

const Game QUIZ_GAME = {
    /* id              */ "quiz",
    /* name            */ "Quiz",
    /* emoji           */ "\xF0\x9F\xA7\xA0",  // 🧠 (UTF-8)
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
