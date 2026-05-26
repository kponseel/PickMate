// Aperolympics SPA core (Socket.IO transport).
//
// Responsibilities:
//  - Socket.IO connection (auto long-polling fallback if WS is blocked)
//  - Single source of truth: the latest server `state` message
//  - Room flow (create / join by code or /r/CODE link)
//  - Routing between shell screens (join / hub / lobby) and the game area
//  - Dispatching renders to the currently-selected game module
//
// A game renderer registers via window.Apero.register(id, {name, emoji, desc,
// rules, mount(area, helpers), render(state, helpers), unmount?(area)}).
// The helpers object is identical to the ESP32 GamesHub one, so renderers port
// over unchanged.

window.Apero = window.Apero || { games: {} };
window.Apero.register = function (id, def) { this.games[id] = def; };
window.GamesHub = window.Apero; // compat alias: ported renderers can keep window.GamesHub.register

(function () {
  var socket, myName = "", myRoom = "", state = null, currentRendererId = null;

  function $(id) { return document.getElementById(id); }
  function setStatus(t) { $("status").textContent = t; }
  function send(o) { if (socket && socket.connected) socket.emit("msg", o); }
  function escapeHtml(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

  var SHELL = ["s-join", "s-hub", "s-lobby", "game-area"];
  function show(id) { SHELL.forEach(function (s) { $(s).classList.toggle("on", s === id); }); }

  function findMe() {
    if (!state || !myName) return null;
    for (var i = 0; i < state.players.length; i++)
      if (state.players[i].name === myName) return state.players[i];
    return null;
  }
  function amHost() { var me = findMe(); return !!(me && me.host); }

  var helpers = { $: $, send: send, setStatus: setStatus, escapeHtml: escapeHtml, findMe: findMe, amHost: amHost };

  function roomShare() {
    var code = (state && state.room) || myRoom;
    return { code: code, url: location.origin + "/r/" + code };
  }
  function renderRoomBadge(targetId) {
    var el = $(targetId); if (!el) return; var s = roomShare();
    el.innerHTML = 'Code : <b>' + escapeHtml(s.code) + '</b> · <span class="muted">' + escapeHtml(s.url) + '</span>';
  }

  function renderPlayerChips(targetId) {
    var el = $(targetId); el.innerHTML = "";
    state.players.forEach(function (p) {
      var c = document.createElement("span");
      c.className = "chip" + (p.connected ? "" : " off");
      c.innerHTML = (p.host ? "<span class=crown>&#x1F451;</span> " : "") + escapeHtml(p.name);
      el.appendChild(c);
    });
  }

  function renderHub() {
    show("s-hub"); renderRoomBadge("hubRoom");
    var list = $("gameList"); list.innerHTML = "";
    var iAmHost = amHost();
    Object.keys(window.Apero.games).forEach(function (id) {
      var g = window.Apero.games[id];
      var card = document.createElement("div");
      card.className = "game-card" + (iAmHost ? "" : " disabled");
      card.innerHTML = '<div class="icon">' + g.emoji + '</div>' +
        '<div><div class="name">' + escapeHtml(g.name) + '</div>' +
        '<div class="muted">' + escapeHtml(g.desc || "") + '</div></div>';
      if (iAmHost) card.onclick = function () { send({ t: "select_game", id: id }); };
      list.appendChild(card);
    });
    $("hubHint").textContent = iAmHost ? "Tu es l'hôte, choisis une épreuve." : "En attente que l'hôte choisisse une épreuve.";
    renderPlayerChips("hubPlayers");
    setStatus("Village olympique — " + myName);
  }

  function renderLobby() {
    show("s-lobby"); renderRoomBadge("lobbyRoom");
    var g = window.Apero.games[state.game];
    $("lobbyEmoji").textContent = g ? g.emoji : "";
    $("lobbyName").textContent = g ? g.name : "";
    if ($("lobbyRules")) $("lobbyRules").innerHTML = (g && g.rules) ? '<h4>📖 Comment jouer</h4>' + g.rules : '';
    renderPlayerChips("lobbyPlayers");
    var iAmHost = amHost();
    $("startBtn").style.display = iAmHost ? "block" : "none";
    $("backToHubBtn").style.display = iAmHost ? "block" : "none";
    $("lobbyHint").textContent = iAmHost ? "Quand tout le monde est là, clique Démarrer." : "En attente du maître du jeu…";
    setStatus("Lobby — " + myName);
  }

  function switchTo(id) {
    var area = $("game-area");
    if (currentRendererId) {
      var prev = window.Apero.games[currentRendererId];
      if (prev && prev.unmount) try { prev.unmount(area, helpers); } catch (e) {}
    }
    area.innerHTML = ""; currentRendererId = null;
    if (id && window.Apero.games[id]) {
      currentRendererId = id;
      var def = window.Apero.games[id];
      if (def.mount) def.mount(area, helpers);
    }
  }

  function render() {
    if (!state || !findMe()) { show("s-join"); return; }
    if (state.game) {
      if (state.phase === "lobby") { if (currentRendererId) switchTo(null); renderLobby(); return; }
      if (state.game !== currentRendererId) switchTo(state.game);
      show("game-area");
      var def = window.Apero.games[state.game];
      if (def && def.render) def.render(state, helpers);
      return;
    }
    if (currentRendererId) switchTo(null);
    renderHub();
  }

  function connect() {
    socket = io({ transports: ["polling", "websocket"] });
    socket.on("connect", function () {
      // Reconnect: rejoin the same room under the same pseudo (score kept).
      if (myName && myRoom) { send({ t: "join", name: myName, room: myRoom }); setStatus("Reconnecté — " + myName); }
      else setStatus("Choisis ton pseudo");
    });
    socket.on("disconnect", function () { setStatus("Déconnecté, reconnexion…"); });
    socket.on("state", function (m) { state = m; myRoom = m.room || myRoom; render(); });
    socket.on("private", function (m) { if (state) { state._private = m.round || {}; render(); } });
    socket.on("error_msg", function (m) { var e = $("joinError"); if (e) e.textContent = (m && m.msg) ? m.msg : "Erreur"; });
  }

  function prefillFromUrl() {
    var m = location.pathname.match(/^\/r\/([A-Za-z0-9]{3,8})/);
    if (m) $("code").value = m[1].toUpperCase();
  }

  document.addEventListener("DOMContentLoaded", function () {
    prefillFromUrl();
    $("createBtn").onclick = function () {
      var n = $("name").value.trim();
      if (!n) { $("joinError").textContent = "Entre un pseudo"; return; }
      myName = n.substring(0, 16); send({ t: "create", name: myName });
    };
    $("joinBtn").onclick = function () {
      var n = $("name").value.trim();
      var c = ($("code").value || "").trim().toUpperCase();
      if (!n) { $("joinError").textContent = "Entre un pseudo"; return; }
      if (!c) { $("joinError").textContent = "Entre un code de partie"; return; }
      myName = n.substring(0, 16); myRoom = c; send({ t: "join", name: myName, room: c });
    };
    $("startBtn").onclick = function () { send({ t: "next" }); };
    $("backToHubBtn").onclick = function () { send({ t: "select_game", id: "" }); };
    connect(); show("s-join");
  });
})();
