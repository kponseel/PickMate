// "Le plus susceptible" — secret vote game.
// Each round, everyone picks a target player. Reveal shows the tally.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="ml-vote">' +
        '<div class="q" id="mlPrompt"></div>' +
        '<div id="mlTargets"></div>' +
        '<div class="center muted" id="mlStatus"></div>' +
      '</div>' +
      '<div class="screen" id="ml-reveal">' +
        '<h2 class="center">Resultats</h2>' +
        '<div class="center muted" id="mlPromptR" style="margin-bottom:14px"></div>' +
        '<ol id="mlVotes"></ol>' +
        '<button class="primary" id="mlNextBtn" style="display:none">Question suivante</button>' +
      '</div>' +
      '<div class="screen" id="ml-end">' +
        '<h2 class="center">Termine !</h2>' +
        '<div class="center muted">Merci d\'avoir joue.</div>' +
        '<button class="primary" id="mlResetBtn" style="display:none">Recommencer</button>' +
      '</div>';

    h.$("mlNextBtn").onclick  = function () { h.send({ t: "next"  }); };
    h.$("mlResetBtn").onclick = function () { h.send({ t: "reset" }); };
  }

  function showScreen(h, id) {
    ["ml-vote", "ml-reveal", "ml-end"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();

    if (state.phase === "playing") {
      showScreen(h, "ml-vote");
      h.$("mlPrompt").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ") " + (r.prompt || "");
      var locked  = !!(me && me.answered);
      var targets = h.$("mlTargets");
      targets.innerHTML = "";
      var voteable = state.players.filter(function (p) { return p.connected; });
      voteable.forEach(function (p) {
        var btn = document.createElement("button");
        btn.className = "ghost";
        btn.style.margin = "4px 0";
        btn.style.width  = "100%";
        btn.disabled = locked;
        btn.innerHTML = (p.host ? '<span class="crown">&#x1F451;</span> ' : '') + h.escapeHtml(p.name);
        btn.onclick = function () {
          if (locked) return;
          // Optimistic lock — disable all targets immediately
          targets.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
          h.$("mlStatus").textContent = "Vote envoye, attends les autres...";
          h.send({ t: "vote", target_id: p.id });
        };
        targets.appendChild(btn);
      });
      h.$("mlStatus").textContent = locked
        ? "Vote envoye, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " / " + state.players.length + " vote(s)") : "");
    } else if (state.phase === "reveal") {
      showScreen(h, "ml-reveal");
      h.$("mlPromptR").textContent = r.prompt || "";
      var ol = h.$("mlVotes"); ol.innerHTML = "";
      var votes = (r.votes || []).slice().sort(function (a, b) { return b.count - a.count; });
      if (!votes.length) {
        var li0 = document.createElement("li");
        li0.innerHTML = '<span style="color:#9aa">Personne n\'a vote</span><b>&nbsp;</b>';
        ol.appendChild(li0);
      } else {
        votes.forEach(function (v) {
          var li = document.createElement("li");
          li.innerHTML = "<span>" + h.escapeHtml(v.name) + "</span><b>" + v.count + " vote" + (v.count > 1 ? "s" : "") + "</b>";
          ol.appendChild(li);
        });
      }
      h.$("mlNextBtn").style.display = h.amHost() ? "block" : "none";
    } else if (state.phase === "finished") {
      showScreen(h, "ml-end");
      h.$("mlResetBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.GamesHub.register("most_likely", {
    name:   "Le plus susceptible",
    emoji:  "😈",
    desc:   "Vote secret : qui est le plus susceptible de... ?",
    mount:  build,
    render: render
  });
})();
