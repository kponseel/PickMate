#include "truth_dare.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Truth & dare prompts (edit freely). Keep them in line with your group.
// ---------------------------------------------------------------------------
static const char* TRUTHS[] = {
    "Quel est ton plus gros mensonge a un parent ?",
    "Quel est ton crush le plus inavoue dans le groupe ?",
    "Quelle est la pire chose que tu aies faite a un ex ?",
    "Quel est ton plus grand secret musical (artiste honteux) ?",
    "Quel est ton souvenir le plus genant en soiree ?",
    "Quel est ton score le plus bas a un examen ?",
    "As-tu deja menti pour eviter quelqu'un dans cette piece ?",
    "Quel est le dernier mensonge que tu as dit ?",
    "Quel est ton fantasme de vacances ?",
    "A quel age as-tu cru au pere Noel jusqu'a... ?",
    "Quelle est la chose la plus chere que tu as cassee ?",
    "Quel est le dernier reve dont tu te souviens ?",
    "Quel est ton plus gros regret de la derniere annee ?",
    "Si tu pouvais changer ton prenom, ce serait lequel ?",
    "Quel est ton plat 'plaisir coupable' ?",
    "Quel personnage de fiction trouves-tu super attirant ?",
    "Quelle est la chose la plus bizarre que tu as deja googlee ?",
    "Quel est ton plus vieux souvenir d'enfance ?",
    "Combien de temps peux-tu rester sans ton tel ?",
    "Quelle est ton pire achat compulsif ?",
};
static const int TRUTH_COUNT = sizeof(TRUTHS) / sizeof(TRUTHS[0]);

static const char* DARES[] = {
    "Imite la personne a ta gauche pendant 30 secondes",
    "Envoie un emoji random a la 3eme personne de ta liste",
    "Fais 10 pompes maintenant",
    "Parle en chuchotant les 2 prochains tours",
    "Danse 15 secondes sans musique",
    "Mets ton t-shirt a l'envers pour le reste du jeu",
    "Appelle un proche et chante 'Joyeux Anniversaire'",
    "Mange/bois un truc en utilisant uniquement ta main faible",
    "Fais un compliment honnete a chaque joueur",
    "Raconte une histoire embarrassante de moins de 30 secondes",
    "Fais un selfie en grimace et envoie-le a un contact au hasard",
    "Imite un animal pendant 20 secondes, les autres devinent",
    "Parle uniquement en chantant pendant 2 tours",
    "Recite l'alphabet a l'envers le plus vite possible",
    "Mets-toi en equilibre sur un pied pendant 30 sec",
    "Joue le role d'un journal televiseé en breaking news pendant 30 sec",
    "Fais ta meilleure imitation de quelqu'un dans la piece",
    "Mange une bouchee avec les yeux fermes (un autre choisit)",
    "Raconte ta journee en utilisant 3 mots tires au hasard du groupe",
    "Tiens-toi sur la pointe des pieds jusqu'a ton prochain tour",
};
static const int DARE_COUNT = sizeof(DARES) / sizeof(DARES[0]);

// ---------------------------------------------------------------------------
namespace {

GamePhase phase        = GAME_PHASE_LOBBY;
int       current_slot = -1;
int       choice       = -1;  // -1=not yet, 0=truth, 1=dare
char      current_prompt[96] = {0};
uint32_t  turn_count   = 0;

int next_active_slot(int from) {
    for (int i = 1; i <= MAX_PLAYERS; i++) {
        int slot = (from + i) % MAX_PLAYERS;
        if (players[slot].active && players[slot].name[0]) return slot;
    }
    return -1;
}

int first_active_slot() {
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0]) return i;
    return -1;
}

void pick_random_prompt(bool dare) {
    int n = dare ? DARE_COUNT : TRUTH_COUNT;
    if (n == 0) { current_prompt[0] = '\0'; return; }
    const char* p = dare ? DARES[random(n)] : TRUTHS[random(n)];
    strncpy(current_prompt, p, sizeof(current_prompt) - 1);
    current_prompt[sizeof(current_prompt) - 1] = '\0';
}

void on_select_impl() {
    phase        = GAME_PHASE_LOBBY;
    current_slot = -1;
    choice       = -1;
    current_prompt[0] = '\0';
    turn_count   = 0;
}

void on_start_impl() {
    // Pick a random active player to start
    int n_active = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0]) n_active++;
    if (n_active == 0) return;
    int target = random(n_active);
    int counted = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && players[i].name[0]) {
            if (counted == target) { current_slot = i; break; }
            counted++;
        }
    }
    choice = -1;
    current_prompt[0] = '\0';
    phase = GAME_PHASE_PLAYING;
    turn_count = 1;
}

void advance_turn() {
    int next = next_active_slot(current_slot);
    if (next < 0) { phase = GAME_PHASE_LOBBY; return; }
    current_slot = next;
    choice = -1;
    current_prompt[0] = '\0';
    turn_count++;
}

void on_advance_impl() {
    if (phase == GAME_PHASE_LOBBY)        on_start_impl();
    else if (phase == GAME_PHASE_PLAYING) advance_turn();
    else                                  on_select_impl();
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* /*p*/) {
    // If we're playing and there was no spotlight (everyone had left), pick one
    if (phase == GAME_PHASE_PLAYING && current_slot < 0) {
        current_slot = first_active_slot();
        choice = -1;
        current_prompt[0] = '\0';
    }
}

void on_player_leave_impl(Player* p) {
    // If the spotlighted player just left, rotate
    if (phase == GAME_PHASE_PLAYING && p && (int)(p - players) == current_slot) {
        advance_turn();
    }
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING) return;
    int slot = (int)(p - players);
    if (slot != current_slot) return;  // only the spotlighted player acts
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t) return;
    if (strcmp(t, "choose") == 0 && choice < 0) {
        const char* v = msg["value"] | "";
        if (strcmp(v, "truth") == 0) { choice = 0; pick_random_prompt(false); }
        else if (strcmp(v, "dare")  == 0) { choice = 1; pick_random_prompt(true);  }
    } else if (strcmp(t, "done") == 0) {
        advance_turn();
    }
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["turn"] = turn_count;
    if (phase != GAME_PHASE_PLAYING || current_slot < 0) return;
    Player& sp = players[current_slot];
    round["current_id"]   = sp.clientId;
    round["current_name"] = sp.name;
    if (choice >= 0) {
        round["choice"] = (choice == 0) ? "truth" : "dare";
        round["prompt"] = current_prompt;
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING && current_slot >= 0)
        snprintf(out, cap, "%s tour %u", players[current_slot].name, (unsigned)turn_count);
    else
        out[0] = '\0';
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game TRUTH_DARE_GAME = {
    /* id              */ "truth_dare",
    /* name            */ "Action ou Verite",
    /* emoji           */ "\xF0\x9F\x8E\xAD",  // 🎭
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
