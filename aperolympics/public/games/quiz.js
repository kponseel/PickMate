// Quiz renderer — owns the DOM inside #game-area while quiz is selected.
// Ported as-is from esp32-hub/data/js/games/quiz.js (same helpers contract);
// the only change is registering on window.Apero. Use this file as the template
// to port the other 15 renderers.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="q-question">' +
        '<div class="q" id="qText"></div>' +
        '<div class="grid">' +
          '<button class="a" id="b0"></button>' +
          '<button class="b" id="b1"></button>' +
          '<button class="c" id="b2"></button>' +
          '<button class="d" id="b3"></button>' +
        '</div>' +
        '<div class="center muted" id="qStatus"></div>' +
      '</div>' +
      '<div class="screen" id="q-reveal">' +
        '<div class="big" id="revealMark"></div>' +
        '<div class="center" id="revealMsg"></div>' +
        '<div class="center muted">Score : <span id="myScore">0</span></div>' +
        '<button class="primary" id="quizNextBtn" style="display:none">Question suivante</button>' +
      '</div>' +
      '<div class="screen" id="q-end">' +
        '<h2>🏅 Podium</h2>' +
        '<ol id="board"></ol>' +
        '<button class="primary" id="quizResetBtn" style="display:none">Recommencer</button>' +
      '</div>';

    for (var i = 0; i < 4; i++) {
      (function (idx) {
        h.$("b" + idx).onclick = function () {
          var me = h.findMe();
          if (me && me.answered) return;
          for (var j = 0; j < 4; j++) h.$("b" + j).disabled = true;
          h.$("qStatus").textContent = "Réponse envoyée, attends les autres…";
          h.send({ t: "answer", choice: idx });
        };
      })(i);
    }
    h.$("quizNextBtn").onclick = function () { h.send({ t: "next" }); };
    h.$("quizResetBtn").onclick = function () { h.send({ t: "reset" }); };
  }

  function showScreen(h, id) {
    ["q-question", "q-reveal", "q-end"].forEach(function (s) { h.$(s).classList.toggle("on", s === id); });
  }

  function render(state, h) {
    var r = state.round || {};
    var me = h.findMe();

    if (state.phase === "playing") {
      showScreen(h, "q-question");
      h.$("qText").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ") " + (r.q || "");
      var locked = !!(me && me.answered);
      for (var i = 0; i < 4; i++) {
        var b = h.$("b" + i);
        b.textContent = (r.options && r.options[i]) || "";
        b.disabled = locked;
      }
      h.$("qStatus").textContent = locked
        ? "Réponse envoyée, attends les autres…"
        : (r.answered !== undefined ? (r.answered + " / " + state.players.length + " répondu(s)") : "");
    } else if (state.phase === "reveal") {
      showScreen(h, "q-reveal");
      var correct = r.correct;
      var ok = !!(me && me.answered && me.answer === correct);
      h.$("myScore").textContent = me ? me.score : 0;
      h.$("revealMark").innerHTML = ok ? "&#9989;" : (me && me.answered ? "&#10060;" : "&#10067;");
      h.$("revealMsg").textContent = "Bonne réponse : " + ["A", "B", "C", "D"][correct];
      h.$("quizNextBtn").style.display = h.amHost() ? "block" : "none";
    } else if (state.phase === "finished") {
      showScreen(h, "q-end");
      var ol = h.$("board"); ol.innerHTML = "";
      var sorted = state.players.slice().sort(function (a, b) { return b.score - a.score; });
      var medals = ["🥇", "🥈", "🥉"];
      sorted.forEach(function (p, i) {
        var li = document.createElement("li");
        li.innerHTML = "<span>" + (medals[i] || (i + 1) + ".") + " " +
          (p.host ? "<span class=crown>&#x1F451;</span> " : "") +
          h.escapeHtml(p.name) + "</span><b>" + p.score + "</b>";
        ol.appendChild(li);
      });
      h.$("quizResetBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.Apero.register("quiz", {
    name: "Quiz",
    emoji: "🧠",
    desc: "Questions à choix multiples, score au chrono.",
    rules: "Une question + 4 options <b>A/B/C/D</b>. Tape la bonne réponse <b>le plus vite possible</b>.<br>" +
           "Score = 500 pts + bonus chrono (plus tu réponds tôt, plus tu marques).<br>" +
           "L'hôte 👑 avance entre chaque question.",
    mount: build,
    render: render,
  });
})();
