#include "game_api.h"
#include "quiz.h"
#include "most_likely.h"
#include "never.h"
#include "would_rather.h"

#include <string.h>

// Registry: list every game module that should appear in the hub. Order here
// is the order shown to players.
const Game* GAMES[] = {
    &QUIZ_GAME,
    &MOST_LIKELY_GAME,
    &NEVER_GAME,
    &WOULD_RATHER_GAME,
};
int GAMES_COUNT = sizeof(GAMES) / sizeof(GAMES[0]);

const Game* current_game = nullptr;

const Game* game_find_by_id(const char* id) {
    if (!id) return nullptr;
    for (int i = 0; i < GAMES_COUNT; i++) {
        if (strcmp(GAMES[i]->id, id) == 0) return GAMES[i];
    }
    return nullptr;
}

void game_select(const Game* g) {
    current_game = g;
    if (g && g->on_select) g->on_select();
}
