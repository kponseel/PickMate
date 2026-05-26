// GamesHub SPA core.
//
// Responsibilities:
//  - WebSocket connection to the ESP32 (auto-reconnect)
//  - Single source of truth: the latest server `state` message
//  - Routing between shell screens (join / hub / lobby) and the in-game area
//  - Dispatching state-change renders to the currently-selected game module
//
// Each game registers itself at load time via window.GamesHub.register(id,
// {name, emoji, desc, mount(area, helpers), render(state, helpers),
// unmount?(area)}). The server registry in src/games/game_api.cpp is the
// source of truth for what's *available*; this client mirror only knows how
// to *display* them.

window.GamesHub = window.GamesHub || { games: {} };
window.GamesHub.register = function (id, def) { this.games[id] = def; };

(function () {
  var ws, myName = "", state = null, currentRendererId = null;

  function $(id) { return document.getElementById(id); }
  function setStatus(t) { $("status").textContent = t; }
  function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
  function escapeHtml(t) { var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

  var SHELL_SCREENS = ["s-join", "s-hub", "s-lobby", "game-area"];
  function show(id) {
    SHELL_SCREENS.forEach(function (s) { $(s).classList.toggle("on", s === id); });
  }

  function findMe() {
    if (!state || !myName) return null;
    for (var i = 0; i < state.players.length; i++)
      if (state.players[i].name === myName) return state.players[i];
    return null;
  }
  function amHost() { var me = findMe(); return !!(me && me.host); }

  // Helpers object passed to each game renderer.
  var helpers = {
    $: $, send: send, setStatus: setStatus, escapeHtml: escapeHtml,
    findMe: findMe, amHost: amHost
  };

  function renderPlayerChips(targetId) {
    var el = $(targetId); el.innerHTML = "";
    state.players.forEach(function (p) {
      var c = document.createElement("span"); c.className = "chip";
      c.innerHTML = (p.host ? "<span class=crown>&#x1F451;</span> " : "") + escapeHtml(p.name);
      el.appendChild(c);
    });
  }

  function renderHub() {
    show("s-hub");
    var list = $("gameList"); list.innerHTML = "";
    var iAmHost = amHost();
    Object.keys(window.GamesHub.games).forEach(function (id) {
      var g = window.GamesHub.games[id];
      var card = document.createElement("div");
      card.className = "game-card" + (iAmHost ? "" : " disabled");
      card.innerHTML =
        '<div class="icon">' + g.emoji + '</div>' +
        '<div><div class="name">' + escapeHtml(g.name) + '</div>' +
        '<div class="muted">' + escapeHtml(g.desc || "") + '</div></div>';
      if (iAmHost) card.onclick = function () { send({ t: "select_game", id: id }); };
      list.appendChild(card);
    });
    $("hubHint").textContent = iAmHost
      ? "Tu es l'hote, clique sur un jeu."
      : "En attente que l'hote choisisse un jeu.";
    renderPlayerChips("hubPlayers");
    setStatus("Hub - " + myName);
  }

  function renderLobby() {
    show("s-lobby");
    var g = window.GamesHub.games[state.game];
    $("lobbyEmoji").textContent = g ? g.emoji : "";
    $("lobbyName").textContent  = g ? g.name  : "";
    renderPlayerChips("lobbyPlayers");
    var iAmHost = amHost();
    $("startBtn").style.display      = iAmHost ? "block" : "none";
    $("backToHubBtn").style.display  = iAmHost ? "block" : "none";
    $("lobbyHint").textContent = iAmHost
      ? "Quand tout le monde est la, clique Demarrer."
      : "En attente du maitre du jeu...";
    setStatus("Lobby - " + myName);
  }

  function switchTo(newGameId) {
    var area = $("game-area");
    if (currentRendererId) {
      var prev = window.GamesHub.games[currentRendererId];
      if (prev && prev.unmount) try { prev.unmount(area, helpers); } catch (e) {}
    }
    area.innerHTML = "";
    currentRendererId = null;
    if (newGameId && window.GamesHub.games[newGameId]) {
      currentRendererId = newGameId;
      var def = window.GamesHub.games[newGameId];
      if (def.mount) def.mount(area, helpers);
    }
  }

  function render() {
    if (!state)        { show("s-join"); return; }
    if (!findMe())     { show("s-join"); return; }

    if (state.game) {
      if (state.phase === "lobby") {
        // Lobby is core (same for every game), even after a game has been picked.
        if (currentRendererId) switchTo(null);
        renderLobby();
        return;
      }
      // In-game: switch renderer if needed, then delegate.
      if (state.game !== currentRendererId) switchTo(state.game);
      show("game-area");
      var def = window.GamesHub.games[state.game];
      if (def && def.render) def.render(state, helpers);
      return;
    }

    // No game picked → hub.
    if (currentRendererId) switchTo(null);
    renderHub();
  }

  function connect() {
    ws = new WebSocket("ws://" + location.host + "/ws");
    ws.onopen = function () {
      if (myName) { send({ t: "join", name: myName }); setStatus("Connecte - " + myName); }
      else        { setStatus("Choisis ton pseudo"); }
    };
    ws.onclose = function () { setStatus("Deconnecte, reconnexion..."); setTimeout(connect, 1500); };
    ws.onmessage = function (e) {
      var m = JSON.parse(e.data);
      if (m.t === "state")   { state = m; render(); }
      else if (m.t === "private" && state) { state._private = m.round || {}; render(); }
    };
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("joinBtn").onclick       = function () { var n = $("name").value.trim(); if (!n) return; myName = n.substring(0, 16); send({ t: "join", name: myName }); };
    $("startBtn").onclick      = function () { send({ t: "next" }); };
    $("backToHubBtn").onclick  = function () { send({ t: "select_game", id: "" }); };
    connect();
    show("s-join");
  });
})();
