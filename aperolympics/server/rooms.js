// Room registry + model.
//
// A Room isolates one group's game. Players are keyed by lowercased name so a
// phone that drops and reconnects under the same pseudo keeps its score
// (name-based reconnect, same idea as the ESP32 firmware).

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous I/O/0/1
const EMPTY_TTL_MS = 10 * 60 * 1000; // delete a room 10 min after it goes empty

class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map(); // nameKey -> player
    this.gameId = null;       // selected game id (null = hub)
    this.game = null;         // game instance (from module.create())
    this.createdAt = Date.now();
    this.emptySince = null;
  }

  activePlayers() {
    return [...this.players.values()].filter((p) => p.active && p.name);
  }

  // Host = the connected player who joined earliest (stable crown).
  hostName() {
    const a = this.activePlayers().sort((x, y) => x.joinedAt - y.joinedAt);
    return a.length ? a[0].name : null;
  }
}

const rooms = new Map();

function genCode() {
  let code;
  do {
    code = "";
    for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  } while (rooms.has(code));
  return code;
}

module.exports = {
  create() {
    const room = new Room(genCode());
    rooms.set(room.code, room);
    return room;
  },
  get(code) {
    return code ? rooms.get(String(code).toUpperCase()) : undefined;
  },
  all() {
    return [...rooms.values()];
  },
  // Periodic housekeeping: drop rooms that have had no connected player for a while.
  sweep() {
    const now = Date.now();
    for (const room of rooms.values()) {
      const hasActive = room.activePlayers().length > 0;
      if (hasActive) {
        room.emptySince = null;
      } else {
        if (room.emptySince == null) room.emptySince = now;
        else if (now - room.emptySince > EMPTY_TTL_MS) rooms.delete(room.code);
      }
    }
  },
};
