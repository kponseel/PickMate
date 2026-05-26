// Quiz game renderer. Owns the DOM inside #game-area while quiz is selected.
//
// Contract (see js/app.js):
//   mount(area, helpers)   - called once when entering the game
//   render(state, helpers) - called on every state push
//   unmount(area, helpers) - optional, called when leaving the game

(function () {
  var lastAnswerChoice = -1;

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
        '<h2>Classement</h2>' +
        '<ol id="board"></ol>' +
        '<button class="primary" id="quizResetBtn" style="display:none">Recommencer</button>' +
      '</div>';

    lastAnswerChoice = -1;

    for (var i = 0; i < 4; i++) {
      (function (idx) {
        h.$("b" + idx).onclick = function () {
          if (lastAnswerChoice >= 0) return;
          lastAnswerChoice = idx;
          h.send({ t: "answer", choice: idx });
          for (var j = 0; j < 4; j++) h.$("b" + j).disabled = true;
          h.$("qStatus").textContent = "Reponse envoyee, attends les autres...";
        };
      })(i);
    }

    h.$("quizNextBtn").onclick  = function () { h.send({ t: "next"  }); };
    h.$("quizResetBtn").onclick = function () { h.send({ t: "reset" }); };
  }

  function showQuizScreen(h, id) {
    ["q-question", "q-reveal", "q-end"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function renderState(state, h) {
    var r = state.round || {};
    if (state.phase === "playing") {
      showQuizScreen(h, "q-question");
      h.$("qText").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ") " + (r.q || "");
      var locked = lastAnswerChoice >= 0;
      for (var i = 0; i < 4; i++) {
        var b = h.$("b" + i);
        b.textContent = (r.options && r.options[i]) || "";
        b.disabled = locked;
      }
      h.$("qStatus").textContent = locked
        ? "Reponse envoyee, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " / " + state.players.length + " repondu(s)") : "");
    } else if (state.phase === "reveal") {
      showQuizScreen(h, "q-reveal");
      var correct = r.correct;
      var me = h.findMe();
      var ok = (lastAnswerChoice === correct);
      h.$("myScore").textContent = me ? me.score : 0;
      h.$("revealMark").innerHTML = ok ? "&#9989;" : "&#10067;";
      h.$("revealMsg").textContent = "Bonne reponse : " + ["A", "B", "C", "D"][correct];
      h.$("quizNextBtn").style.display = h.amHost() ? "block" : "none";
      lastAnswerChoice = -1;
    } else if (state.phase === "finished") {
      showQuizScreen(h, "q-end");
      var ol = h.$("board"); ol.innerHTML = "";
      var sorted = state.players.slice().sort(function (a, b) { return b.score - a.score; });
      sorted.forEach(function (p, i) {
        var li = document.createElement("li");
        li.innerHTML = "<span>" + (i + 1) + ". " +
                       (p.host ? "<span class=crown>&#x1F451;</span> " : "") +
                       h.escapeHtml(p.name) + "</span><b>" + p.score + "</b>";
        ol.appendChild(li);
      });
      h.$("quizResetBtn").style.display = h.amHost() ? "block" : "none";
      lastAnswerChoice = -1;
    }
  }

  window.GamesHub.register("quiz", {
    name:  "Quiz",
    emoji: "🧠",  // 🧠
    desc:  "Questions a choix multiples, score chrono.",
    mount:  build,
    render: renderState
  });
})();
