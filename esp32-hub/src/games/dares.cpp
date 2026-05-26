#include "dares.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

static const char* DARES[] = {
    "Imite ton acteur prefere pendant 20 secondes",
    "Chante 5 secondes de ta chanson preferee",
    "Fais 10 pompes (vraiment)",
    "Parle uniquement avec des questions pendant 3 tours",
    "Mime un animal, les autres devinent en 30 sec",
    "Appelle un proche et dis lui une phrase au hasard du groupe",
    "Mets ton t-shirt a l'envers pour les 10 prochaines minutes",
    "Compose un petit poeme avec 3 mots tires des autres",
    "Raconte une histoire embarrassante en 30 secondes",
    "Fais le meme bruit qu'un animal jusqu'au prochain tour",
    "Danse 15 secondes sans musique",
    "Envoie un emoji aleatoire a la 5eme personne de tes contacts",
    "Fais un compliment honnete a chaque joueur",
    "Bois ton verre avec ta main faible jusqu'au prochain tour",
    "Imite quelqu'un dans le groupe, les autres devinent",
    "Recite l'alphabet a l'envers le plus vite possible",
    "Fais 5 burpees devant tout le monde",
    "Parle en yaourt anglais pendant 1 minute",
    "Fais une publicite pour un objet aleatoire dans la piece",
    "Pose une question genante a la personne a ta droite",
    "Raconte une blague vraiment nulle",
    "Fais comme si tu etais un journaliste en plein direct",
    "Bouge comme un robot pendant les 2 prochains tours",
    "Mets-toi a quatre pattes et fais un tour de la piece",
    "Parle uniquement en chuchotant pendant les 3 prochains tours",
};
static const int DARE_COUNT = sizeof(DARES) / sizeof(DARES[0]);

namespace {

GamePhase phase = GAME_PHASE_LOBBY;
int       picked_slot = -1;
int       dare_idx    = -1;
uint32_t  round_n     = 0;

int slot_of(const Player* p) {
    if (!p) return -1;
    int idx = (int)(p - players);
    return (idx >= 0 && idx < MAX_PLAYERS) ? idx : -1;
}

int random_active_slot() {
    int actives[MAX_PLAYERS]; int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0]) actives[n++] = i;
    if (n == 0) return -1;
    return actives[random(n)];
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY;
    picked_slot = -1; dare_idx = -1; round_n = 0;
}

void on_start_impl() {
    int s = random_active_slot();
    if (s < 0) return;
    picked_slot = s;
    dare_idx    = (DARE_COUNT > 0) ? random(DARE_COUNT) : -1;
    phase       = GAME_PHASE_PLAYING;
    round_n++;
}

void on_advance_impl() {
    if (phase == GAME_PHASE_LOBBY)   on_start_impl();
    else                              on_start_impl();   // pick again
}

void on_reset_impl() { on_select_impl(); }
void on_player_join_impl(Player* /*p*/) {}

void on_player_leave_impl(Player* p) {
    if (phase != GAME_PHASE_PLAYING) return;
    if (slot_of(p) == picked_slot) on_start_impl();
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING) return;
    int slot = slot_of(p);
    if (slot != picked_slot) return;
    const char* t = msg["t"] | (const char*)nullptr;
    if (t && strcmp(t, "done") == 0) on_advance_impl();
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["round_n"] = round_n;
    if (phase != GAME_PHASE_PLAYING) return;
    if (picked_slot >= 0) {
        round["picked_id"]   = players[picked_slot].clientId;
        round["picked_name"] = players[picked_slot].name;
    }
    if (dare_idx >= 0) round["dare"] = DARES[dare_idx];
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING && picked_slot >= 0)
        snprintf(out, cap, "%s tour %u", players[picked_slot].name, (unsigned)round_n);
    else
        out[0] = '\0';
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game DARES_GAME = {
    /* id              */ "dares",
    /* name            */ "Gages",
    /* emoji           */ "\xF0\x9F\x8E\xB2",  // 🎲
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
