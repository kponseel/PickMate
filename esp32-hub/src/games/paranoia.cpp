#include "paranoia.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Question pool — kept playful, the spice is in the mystery, not the prompt.
// ---------------------------------------------------------------------------
static const char* PROMPTS[] = {
    "Qui dans le groupe a le pire gout musical ?",
    "Avec qui partirais-tu en road-trip sans hesiter ?",
    "Qui ferait le pire colocataire ?",
    "Qui te raconte les meilleures histoires ?",
    "Avec qui voudrais-tu echanger ta vie pour un jour ?",
    "Qui est secretement le plus competitif ?",
    "Qui peut le moins garder un secret ?",
    "Qui dans le groupe est ton acolyte ideal pour un mauvais coup ?",
    "Qui prendrais-tu en premier dans une equipe de quiz ?",
    "Qui a le plus de chance de devenir riche ?",
    "Avec qui passerais-tu un weekend sur une ile deserte ?",
    "Qui ferait le meilleur DJ de soiree ?",
    "Qui dans le groupe est le plus mauvais perdant ?",
    "Avec qui ferais-tu equipe pour braquer une banque (hypothetique) ?",
    "Qui est le plus susceptible de finir prof de yoga ?",
};
static const int PROMPT_COUNT = sizeof(PROMPTS) / sizeof(PROMPTS[0]);

// ---------------------------------------------------------------------------
namespace {

GamePhase phase            = GAME_PHASE_LOBBY;
int       whisperer_slot   = -1;
int       accused_slot     = -1;
char      current_prompt[160] = {0};
bool      reveal_prompt    = false;   // set at the moment whisperer points
uint32_t  turn             = 0;

int next_active_slot(int from) {
    for (int i = 1; i <= MAX_PLAYERS; i++) {
        int s = (from + i) % MAX_PLAYERS;
        if (players[s].active && players[s].name[0]) return s;
    }
    return -1;
}

void pick_prompt() {
    if (PROMPT_COUNT == 0) { current_prompt[0] = '\0'; return; }
    const char* p = PROMPTS[random(PROMPT_COUNT)];
    strncpy(current_prompt, p, sizeof(current_prompt) - 1);
    current_prompt[sizeof(current_prompt) - 1] = '\0';
}

void on_select_impl() {
    phase           = GAME_PHASE_LOBBY;
    whisperer_slot  = -1;
    accused_slot    = -1;
    current_prompt[0] = '\0';
    reveal_prompt   = false;
    turn            = 0;
}

void on_start_impl() {
    // Pick a random first whisperer among active players
    int n_active = 0;
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0]) n_active++;
    if (n_active == 0) return;
    int target  = random(n_active);
    int counted = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (players[i].active && players[i].name[0]) {
            if (counted == target) { whisperer_slot = i; break; }
            counted++;
        }
    }
    accused_slot  = -1;
    reveal_prompt = false;
    pick_prompt();
    phase = GAME_PHASE_PLAYING;
    turn  = 1;
}

void next_turn() {
    int next = next_active_slot(whisperer_slot);
    if (next < 0) { phase = GAME_PHASE_LOBBY; return; }
    whisperer_slot = next;
    accused_slot   = -1;
    reveal_prompt  = false;
    pick_prompt();
    phase = GAME_PHASE_PLAYING;
    turn++;
}

void on_advance_impl() {
    if (phase == GAME_PHASE_LOBBY)        on_start_impl();
    else if (phase == GAME_PHASE_PLAYING) { phase = GAME_PHASE_REVEAL; reveal_prompt = (random(2) == 0); }
    else if (phase == GAME_PHASE_REVEAL)  next_turn();
    else                                  on_select_impl();
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* /*p*/) {
    if (phase == GAME_PHASE_PLAYING && whisperer_slot < 0) {
        // Game limped along with no whisperer (everyone had left); pick fresh
        on_start_impl();
    }
}

void on_player_leave_impl(Player* p) {
    if (!p) return;
    int slot = (int)(p - players);
    if (phase == GAME_PHASE_PLAYING && slot == whisperer_slot) {
        // The whisperer left mid-turn — rotate to next active.
        next_turn();
    }
    if (phase == GAME_PHASE_REVEAL && slot == accused_slot) {
        // Accusee left during reveal — keep the reveal, no rotation here.
    }
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING) return;
    int slot = (int)(p - players);
    if (slot != whisperer_slot) return;  // only whisperer can act
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t || strcmp(t, "point") != 0) return;
    uint32_t target_id = msg["target_id"] | 0u;
    Player* tg = findPlayer(target_id);
    if (!tg) return;
    int tslot = (int)(tg - players);
    if (tslot < 0 || tslot >= MAX_PLAYERS) return;
    accused_slot  = tslot;
    reveal_prompt = (random(2) == 0);   // 50/50 coin
    phase = GAME_PHASE_REVEAL;
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["turn"] = turn;
    if (phase == GAME_PHASE_LOBBY) return;

    if (whisperer_slot >= 0) {
        Player& w = players[whisperer_slot];
        round["whisperer_id"]   = w.clientId;
        round["whisperer_name"] = w.name;
    }
    if (phase == GAME_PHASE_REVEAL && accused_slot >= 0) {
        Player& a = players[accused_slot];
        round["accused_id"]     = a.clientId;
        round["accused_name"]   = a.name;
        round["coin"]           = reveal_prompt ? "open" : "sealed";
        if (reveal_prompt) round["prompt"] = current_prompt;
    }
}

// Private payload: only the whisperer (during PLAYING) gets the prompt.
void serialize_private_impl(const Player* viewer, JsonObject out) {
    if (!viewer || phase != GAME_PHASE_PLAYING || whisperer_slot < 0) return;
    int vslot = (int)(viewer - players);
    if (vslot != whisperer_slot) return;
    out["prompt"]   = current_prompt;
    out["your_turn"] = true;
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING && whisperer_slot >= 0)
        snprintf(out, cap, "%s pose...", players[whisperer_slot].name);
    else if (phase == GAME_PHASE_REVEAL && accused_slot >= 0)
        snprintf(out, cap, "%s vs %s", players[whisperer_slot].name, players[accused_slot].name);
    else
        out[0] = '\0';
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game PARANOIA_GAME = {
    /* id              */ "paranoia",
    /* name            */ "Paranoia",
    /* emoji           */ "\xF0\x9F\x91\x80",  // 👀
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
    /* serialize_private*/ serialize_private_impl,
    /* tick            */ tick_impl,
};
