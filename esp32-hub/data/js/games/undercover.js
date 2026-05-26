// Undercover — each phone shows its secret word; vote who's the imposter.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="uc-play">' +
        '<div class="muted center">Ton mot secret :</div>' +
        '<div class="q center" id="ucWord" style="background:#1b1d35;border-radius:12px;padding:24px;font-size:1.8rem;font-weight:700;margin:8px 0 18px"></div>' +
        '<div class="muted center" id="ucRole" style="margin-bottom:14px"></div>' +
        '<div class="muted center" style="margin-bottom:6px">Discutez en personne, puis votez qui est l\'undercover :</div>' +
        '<div id="ucTargets"></div>' +
        '<div class="center muted" id="ucStatus" style="margin-top:10px"></div>' +
      '</div>' +
      '<div class="screen" id="uc-reveal">' +
        '<h2 class="center" id="ucWinner"></h2>' +
        '<div class="muted center" style="margin:8px 0 14px">Mots du tour :</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">' +
          '<div style="background:#26890c;padding:14px;border-radius:10px;text-align:center"><div class="muted" style="color:#cdd">Majorite</div><div id="ucWC" style="font-size:1.2rem;font-weight:700"></div></div>' +
          '<div style="background:#e6394a;padding:14px;border-radius:10px;text-align:center"><div class="muted" style="color:#fff">Undercover</div><div id="ucWU" style="font-size:1.2rem;font-weight:700"></div></div>' +
        '</div>' +
        '<div class="muted">Undercover(s) :</div>' +
        '<div id="ucUcs" style="margin-bottom:14px"></div>' +
        '<div class="muted">Votes :</div>' +
        '<ol id="ucVotes"></ol>' +
        '<button class="primary" id="ucNextBtn" style="display:none;margin-top:12px">Nouveau tour</button>' +
      '</div>';

    h.$("ucNextBtn").onclick = function () { h.send({ t: "next" }); };
  }

  function showScreen(h, id) {
    ["uc-play", "uc-reveal"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r    = state.round || {};
    var me   = h.findMe();
    var priv = state._private || {};

    if (state.phase === "lobby") {
      h.$("ucWord").textContent = "(en attente du demarrage)";
      h.$("ucRole").textContent = "";
      showScreen(h, "uc-play");
      h.$("ucTargets").innerHTML = "";
      h.$("ucStatus").textContent = "";
      return;
    }

    if (state.phase === "playing") {
      showScreen(h, "uc-play");
      h.$("ucWord").textContent = priv.word || "(privé, rafraîchis si vide)";
      var role = priv.role || "civilian";
      h.$("ucRole").textContent = role === "spectator"
        ? "Tu as rejoint en cours de tour, tu es spectateur·rice ce round."
        : (role === "undercover" ? "🕵️ Tu es UNDERCOVER. Sois discret·e !" : "👥 Tu es civil·e.");

      var locked = !!(me && me.answered);
      var targets = h.$("ucTargets");
      targets.innerHTML = "";
      var ucMe = role === "undercover";
      state.players.filter(function (p) { return p.connected; }).forEach(function (p) {
        var btn = document.createElement("button");
        btn.className = "ghost";
        btn.style.margin = "4px 0";
        btn.style.width  = "100%";
        btn.disabled = locked || (me && p.id === me.id);
        btn.innerHTML = (p.host ? '<span class="crown">&#x1F451;</span> ' : '') + h.escapeHtml(p.name);
        btn.onclick = function () {
          if (locked) return;
          targets.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
          h.$("ucStatus").textContent = "Vote envoye, attends les autres...";
          h.send({ t: "vote", target_id: p.id });
        };
        targets.appendChild(btn);
      });
      h.$("ucStatus").textContent = locked
        ? "Vote envoye, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " vote(s)") : "");
      return;
    }

    if (state.phase === "reveal") {
      showScreen(h, "uc-reveal");
      h.$("ucWinner").innerHTML = (r.winner === "civilians" ? "🎉 Les civils gagnent !" : "🕵️ L'undercover gagne !");
      h.$("ucWC").textContent = r.word_civ || "?";
      h.$("ucWU").textContent = r.word_uc  || "?";
      var ucs = h.$("ucUcs"); ucs.innerHTML = "";
      (r.undercovers || []).forEach(function (n) {
        var chip = document.createElement("span"); chip.className = "chip";
        chip.style.background = "#e6394a";
        chip.textContent = n;
        ucs.appendChild(chip);
      });
      var ol = h.$("ucVotes"); ol.innerHTML = "";
      var sorted = (r.votes || []).slice().sort(function (a, b) { return b.count - a.count; });
      sorted.forEach(function (v) {
        var li = document.createElement("li");
        li.innerHTML = "<span>" + h.escapeHtml(v.name) + "</span><b>" + v.count + "</b>";
        ol.appendChild(li);
      });
      h.$("ucNextBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.GamesHub.register("undercover", {
    name:   "Undercover",
    emoji:  "🕵️",
    desc:   "Mot secret different pour l'intrus. Trouvez-le ! (3 joueurs min)",
    mount:  build,
    render: render
  });
})();
