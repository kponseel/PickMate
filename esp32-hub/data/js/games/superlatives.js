// "Superlatifs" — same UI as most_likely; the server picks from a different
// prompt bank framed as "Le/la plus X du groupe".

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="sl-vote">' +
        '<div class="q" id="slPrompt"></div>' +
        '<div id="slTargets"></div>' +
        '<div class="center muted" id="slStatus"></div>' +
      '</div>' +
      '<div class="screen" id="sl-reveal">' +
        '<h2 class="center">🏆 Resultats</h2>' +
        '<div class="center muted" id="slPromptR" style="margin-bottom:14px"></div>' +
        '<ol id="slVotes"></ol>' +
        '<button class="primary" id="slNextBtn" style="display:none">Categorie suivante</button>' +
      '</div>' +
      '<div class="screen" id="sl-end">' +
        '<h2 class="center">Termine !</h2>' +
        '<button class="primary" id="slResetBtn" style="display:none">Recommencer</button>' +
      '</div>';

    h.$("slNextBtn").onclick  = function () { h.send({ t: "next"  }); };
    h.$("slResetBtn").onclick = function () { h.send({ t: "reset" }); };
  }

  function showScreen(h, id) {
    ["sl-vote", "sl-reveal", "sl-end"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();
    if (state.phase === "playing") {
      showScreen(h, "sl-vote");
      h.$("slPrompt").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ") " + (r.prompt || "");
      var locked  = !!(me && me.answered);
      var targets = h.$("slTargets");
      targets.innerHTML = "";
      state.players.filter(function (p) { return p.connected; }).forEach(function (p) {
        var btn = document.createElement("button");
        btn.className = "ghost";
        btn.style.margin = "4px 0";
        btn.style.width  = "100%";
        btn.disabled = locked;
        btn.innerHTML = (p.host ? '<span class="crown">&#x1F451;</span> ' : '') + h.escapeHtml(p.name);
        btn.onclick = function () {
          if (locked) return;
          targets.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
          h.$("slStatus").textContent = "Vote envoye, attends les autres...";
          h.send({ t: "vote", target_id: p.id });
        };
        targets.appendChild(btn);
      });
      h.$("slStatus").textContent = locked
        ? "Vote envoye, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " / " + state.players.length + " vote(s)") : "");
    } else if (state.phase === "reveal") {
      showScreen(h, "sl-reveal");
      h.$("slPromptR").textContent = r.prompt || "";
      var ol = h.$("slVotes"); ol.innerHTML = "";
      var votes = (r.votes || []).slice().sort(function (a, b) { return b.count - a.count; });
      if (!votes.length) {
        var li0 = document.createElement("li");
        li0.innerHTML = '<span style="color:#9aa">Personne n\'a vote</span><b>&nbsp;</b>';
        ol.appendChild(li0);
      } else {
        votes.forEach(function (v, i) {
          var medal = (i === 0) ? "🥇 " : (i === 1 ? "🥈 " : (i === 2 ? "🥉 " : ""));
          var li = document.createElement("li");
          li.innerHTML = "<span>" + medal + h.escapeHtml(v.name) + "</span><b>" + v.count + "</b>";
          ol.appendChild(li);
        });
      }
      h.$("slNextBtn").style.display = h.amHost() ? "block" : "none";
    } else if (state.phase === "finished") {
      showScreen(h, "sl-end");
      h.$("slResetBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.GamesHub.register("superlatives", {
    name:   "Superlatifs",
    emoji:  "🏆",
    desc:   "Vote secret : qui est le/la plus X du groupe ?",
    rules:  "Variante de \"Le plus susceptible\" mais avec des <b>categories</b> : drole, style, organise, voyageur...<br>" +
            "Vote secret pour le/la plus <b>X du groupe</b>.<br>" +
            "Reveal sous forme de <b>podium</b> 🥇🥈🥉 avec les compteurs.",
    mount:  build,
    render: render
  });
})();
