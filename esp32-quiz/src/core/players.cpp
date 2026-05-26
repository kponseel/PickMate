#include "players.h"
#include <string.h>

Player players[MAX_PLAYERS];

Player* findPlayer(uint32_t clientId) {
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (players[i].active && players[i].clientId == clientId) return &players[i];
    return nullptr;
}

Player* findReconnectSlot(const char* name) {
    for (int i = 0; i < MAX_PLAYERS; i++)
        if (!players[i].active && players[i].name[0] &&
            strncmp(players[i].name, name, MAX_NAME_LEN) == 0)
            return &players[i];
    return nullptr;
}

Player* addPlayer(uint32_t clientId) {
    int reuse = -1;
    for (int i = 0; i < MAX_PLAYERS; i++) {
        if (!players[i].active && players[i].name[0] == '\0') {  // prefer a truly empty slot
            players[i] = Player{};
            players[i].active   = true;
            players[i].clientId = clientId;
            return &players[i];
        }
        if (!players[i].active && reuse < 0) reuse = i;  // else evict a disconnected ghost
    }
    if (reuse >= 0) {
        players[reuse] = Player{};
        players[reuse].active   = true;
        players[reuse].clientId = clientId;
        return &players[reuse];
    }
    return nullptr;
}

void removePlayer(uint32_t clientId) {
    Player* p = findPlayer(clientId);
    if (p) p->active = false;  // keep name+score so the player can reconnect
}

int activeCount() {
    int n = 0;
    for (int i = 0; i < MAX_PLAYERS; i++) if (players[i].active && players[i].name[0]) n++;
    return n;
}
