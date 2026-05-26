#include "kings.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

// ---------------------------------------------------------------------------
// Card rules — indexed by rank (0 = Ace, 1 = 2, ... 12 = King).
// ---------------------------------------------------------------------------
struct CardRule { const char* name; const char* rule; };

static const CardRule RULES[] = {
    {"As",      "Cascade — chacun bois 1s en regardant le suivant"},
    {"2",       "Tu — choisis qui bois"},
    {"3",       "Moi — bois toi-meme"},
    {"4",       "Filles — toutes les filles boivent"},
    {"5",       "Pouce — pose discretement le pouce sur la table ; dernier·e a le faire bois"},
    {"6",       "Gars — tous les gars boivent"},
    {"7",       "Ciel — dernier·e a lever la main bois"},
    {"8",       "Partenaire — choisis un·e partenaire de gorgee jusqu'au prochain 8"},
    {"9",       "Rime — donne un mot, chacun rime ; premier·e qui rate bois"},
    {"10",      "Categorie — donne un theme, chacun cite ; premier·e qui rate bois"},
    {"Valet",   "Regle — impose une nouvelle regle pour la partie"},
    {"Reine",   "Question — pose des questions ; premier·e a y repondre bois"},
    {"Roi",     "Verse un peu de ta boisson dans la Coupe Royale"},
};

static const char* SUITS[] = { "♥", "♦", "♣", "♠" };

namespace {

GamePhase phase             = GAME_PHASE_LOBBY;
uint8_t   deck[52]          = {0};
int       deck_pos          = 0;     // next index to draw, 0..52
int       current_slot      = -1;
int       last_card         = -1;    // 0..51, or -1 = "not drawn yet"
int       kings_drawn       = 0;
uint32_t  round_n           = 0;

int next_active_slot(int from) {
    for (int i = 1; i <= MAX_PLAYERS; i++) {
        int s = (from + i) % MAX_PLAYERS;
        if (players[s].active && players[s].name[0]) return s;
    }
    return -1;
}

int first_active_slot() {
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].name[0]) return i;
    return -1;
}

void shuffle_deck() {
    for (int i = 0; i < 52; i++) deck[i] = (uint8_t)i;
    for (int i = 51; i > 0; i--) {
        int j = random(i + 1);
        uint8_t t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    deck_pos    = 0;
    last_card   = -1;
    kings_drawn = 0;
}

int slot_of(const Player* p) {
    if (!p) return -1;
    int idx = (int)(p - players);
    return (idx >= 0 && idx < MAX_PLAYERS) ? idx : -1;
}

void on_select_impl() {
    phase = GAME_PHASE_LOBBY;
    current_slot = -1;
    deck_pos = 0; last_card = -1; kings_drawn = 0;
    round_n = 0;
}

void on_start_impl() {
    shuffle_deck();
    current_slot = first_active_slot();
    if (current_slot < 0) return;
    phase = GAME_PHASE_PLAYING;
    round_n++;
}

void draw_card() {
    if (deck_pos >= 52) { phase = GAME_PHASE_FINISHED; return; }
    last_card = deck[deck_pos++];
    int rank = last_card % 13;
    if (rank == 12) {  // King
        kings_drawn++;
        if (kings_drawn >= 4) phase = GAME_PHASE_FINISHED;
    }
}

void rotate_turn() {
    int next = next_active_slot(current_slot);
    if (next < 0) { phase = GAME_PHASE_LOBBY; return; }
    current_slot = next;
    last_card    = -1;
}

void on_advance_impl() {
    if      (phase == GAME_PHASE_LOBBY)    on_start_impl();
    else if (phase == GAME_PHASE_PLAYING) {
        if (last_card < 0) draw_card();
        else               rotate_turn();
    }
    else if (phase == GAME_PHASE_FINISHED) on_select_impl();
    else                                   on_select_impl();
}

void on_reset_impl() { on_select_impl(); }

void on_player_join_impl(Player* /*p*/) {
    if (phase == GAME_PHASE_PLAYING && current_slot < 0)
        current_slot = first_active_slot();
}

void on_player_leave_impl(Player* p) {
    int slot = slot_of(p);
    if (phase == GAME_PHASE_PLAYING && slot == current_slot) rotate_turn();
}

void on_message_impl(Player* p, const JsonDocument& msg) {
    if (!p || phase != GAME_PHASE_PLAYING) return;
    int slot = slot_of(p);
    if (slot != current_slot) return;
    const char* t = msg["t"] | (const char*)nullptr;
    if (!t) return;
    // Strict matching so a double-tap doesn't draw + rotate in one shot
    if (strcmp(t, "draw") == 0 && last_card < 0)        on_advance_impl();
    else if (strcmp(t, "end_turn") == 0 && last_card >= 0) on_advance_impl();
}

GamePhase phase_impl() { return phase; }

void serialize_round_impl(JsonObject round) {
    round["round_n"]     = round_n;
    round["deck_left"]   = 52 - deck_pos;
    round["kings_drawn"] = kings_drawn;
    if (phase == GAME_PHASE_LOBBY) return;

    if (current_slot >= 0) {
        round["current_id"]   = players[current_slot].clientId;
        round["current_name"] = players[current_slot].name;
    }
    if (last_card >= 0) {
        int rank = last_card % 13;
        int suit = last_card / 13;
        round["card"]      = (rank < 13) ? RULES[rank].name : "?";
        round["card_full"] = (rank < 13) ? RULES[rank].name : "?";
        round["suit"]      = (suit >= 0 && suit < 4) ? SUITS[suit] : "?";
        round["rule"]      = (rank < 13) ? RULES[rank].rule : "?";
        round["is_king"]   = (rank == 12);
    }
    if (phase == GAME_PHASE_FINISHED) {
        round["royal_cup"] = (last_card >= 0 && current_slot >= 0) ? (const char*)players[current_slot].name : (const char*)"";
    }
}

void flipper_progress_impl(char* out, size_t cap) {
    if (cap == 0) return;
    if (phase == GAME_PHASE_PLAYING && current_slot >= 0)
        snprintf(out, cap, "%s K:%d/4 D:%d", players[current_slot].name, kings_drawn, 52 - deck_pos);
    else if (phase == GAME_PHASE_FINISHED)
        snprintf(out, cap, "fin K:%d", kings_drawn);
    else
        out[0] = '\0';
}

bool tick_impl(uint32_t /*now_ms*/) { return false; }

}  // namespace

const Game KINGS_GAME = {
    /* id              */ "kings",
    /* name            */ "Roi des Bieres",
    /* emoji           */ "\xF0\x9F\x91\x91",  // 👑
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
