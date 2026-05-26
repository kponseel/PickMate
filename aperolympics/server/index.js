// Aperolympics server: serves the PWA (public/) and runs the realtime layer.
//
// Transport = Socket.IO. On managed/shared hosting that blocks INCOMING
// WebSockets (e.g. Hostinger Business), Socket.IO falls back to HTTP
// long-polling automatically, so the game still works. One single Node process
// serves both the static SPA and the realtime endpoint, and holds room state in
// memory (the process is persistent).

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const rooms = require("./rooms");
const registry = require("./games/registry");

const PORT = process.env.PORT || 3000;

const app = express();
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use(express.static(PUBLIC_DIR));

// Join-by-link: /r/CODE serves the SPA, which reads the code from the URL.
app.get("/r/:code", (_req, res) => res.sendFile(path.join(PUBLIC_DIR, "index.html")));

const server = http.createServer(app);
const io = new Server(server, {
  // Keep both transports; on hosts that block the WS upgrade it stays on polling.
  transports: ["polling", "websocket"],
});

// --- helpers ---------------------------------------------------------------
function buildState(room) {
  const hostName = room.hostName();
  const phase = room.game ? room.game.phase() : "lobby";
  const players = [];
  room.players.forEach((p) => {
    if (!p.name) return;
    players.push({
      id: p.name,
      name: p.name,
      score: p.score,
      connected: p.active,
      host: p.active && p.name === hostName,
      answered: p.answered,
      answer: p.answer,
    });
  });
  return {
    t: "state",
    room: room.code,
    phase,
    game: room.gameId,
    hostId: hostName,
    players,
    round: room.game && room.game.serializeRound ? room.game.serializeRound(room) : {},
  };
}

function broadcast(room) {
  io.to(room.code).emit("state", buildState(room));
  if (room.game && room.game.serializePrivate) {
    room.players.forEach((p) => {
      if (!p.active) return;
      const priv = room.game.serializePrivate(room, p);
      if (priv && Object.keys(priv).length) {
        const s = io.sockets.sockets.get(p.socketId);
        if (s) s.emit("private", { t: "private", round: priv });
      }
    });
  }
}

function playerOf(socket, room) {
  return room ? room.players.get(socket.data.playerKey) : undefined;
}
function isHost(socket, room) {
  const p = playerOf(socket, room);
  return !!(p && p.name === room.hostName());
}

function joinRoom(socket, room, rawName) {
  const name = String(rawName || "Joueur").trim().slice(0, 16) || "Joueur";
  const key = name.toLowerCase();
  let p = room.players.get(key);
  if (!p) {
    p = { name, score: 0, answered: false, answer: -1, answerMs: 0, joinedAt: Date.now(), active: true, socketId: socket.id };
    room.players.set(key, p);
  } else {
    p.active = true;
    p.socketId = socket.id;
    p.name = name;
  }
  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.playerKey = key;
  if (room.game && room.game.onPlayerJoin) room.game.onPlayerJoin(room, p);
  broadcast(room);
}

// --- realtime --------------------------------------------------------------
io.on("connection", (socket) => {
  socket.on("msg", (m) => {
    if (!m || typeof m.t !== "string") return;

    if (m.t === "create") {
      const room = rooms.create();
      joinRoom(socket, room, m.name);
      return;
    }
    if (m.t === "join") {
      const room = rooms.get(m.room);
      if (!room) { socket.emit("error_msg", { msg: "Partie introuvable" }); return; }
      joinRoom(socket, room, m.name);
      return;
    }

    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const player = playerOf(socket, room);

    if (m.t === "select_game") {
      if (!isHost(socket, room)) return;
      const id = m.id || "";
      if (!id) { room.gameId = null; room.game = null; }
      else {
        const g = registry.get(id);
        if (g) { room.gameId = id; room.game = g.create(); if (room.game.onSelect) room.game.onSelect(room); }
      }
      broadcast(room);
    } else if (m.t === "next" || m.t === "start") {
      if (isHost(socket, room) && room.game) { room.game.onAdvance(room); broadcast(room); }
    } else if (m.t === "reset") {
      if (isHost(socket, room) && room.game) { room.game.onReset(room); broadcast(room); }
    } else if (room.game && room.game.onMessage && player) {
      room.game.onMessage(room, player, m);
      broadcast(room);
    }
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const p = playerOf(socket, room);
    if (p && p.socketId === socket.id) {
      p.active = false;
      if (room.game && room.game.onPlayerLeave) room.game.onPlayerLeave(room, p);
    }
    broadcast(room);
  });
});

// Per-room timers (quiz countdown, bomb, etc.) + room housekeeping.
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.all()) {
    if (room.game && room.game.tick && room.game.tick(room, now)) broadcast(room);
  }
  rooms.sweep();
}, 500);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[Aperolympics] up on :${PORT} — ${registry.list().length} game(s) registered`);
});
