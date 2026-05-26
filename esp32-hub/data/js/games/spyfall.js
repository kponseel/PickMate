// Spyfall — everyone but one knows the location. Vote who's the spy.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="sp-play">' +
        '<div class="muted center" id="spRoleHeader">Tu es...</div>' +
        '<div class="q center" id="spRoleBox" style="background:#1b1d35;border-radius:12px;padding:24px;margin:8px 0 6px;min-height:90px;display:flex;align-items:center;justify-content:center;flex-direction:column"></div>' +
        '<div class="muted center" id="spHint" style="margin-bottom:14px"></div>' +
        '<div class="muted center" style="margin-bottom:6px">Discutez. Posez des questions pour debusquer l\'espion.</div>' +
        '<div id="spTargets"></div>' +
        '<div class="center muted" id="spStatus" style="margin-top:10px"></div>' +
      '</div>' +
      '<div class="screen" id="sp-reveal">' +
        '<h2 class="center" id="spWinner"></h2>' +
        '<div class="muted center" style="margin:8px 0">Le lieu etait :</div>' +
        '<div class="q center" id="spLocR" style="background:#1b1d35;border-radius:12px;padding:14px;font-size:1.2rem;font-weight:700;margin-bottom:14px"></div>' +
        '<div class="muted center" style="margin-bottom:4px">L\'espion etait :</div>' +
        '<div class="center" id="spSpyR" style="font-size:1.2rem;font-weight:700;color:#ffd56b;margin-bottom:14px"></div>' +
        '<div class="muted">Votes :</div>' +
        '<ol id="spVotes"></ol>' +
        '<button class="primary" id="spNextBtn" style="display:none;margin-top:12px">Nouveau tour</button>' +
      '</div>';

    h.$("spNextBtn").onclick = function () { h.send({ t: "next" }); };
  }

  function showScreen(h, id) {
    ["sp-play", "sp-reveal"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r    = state.round || {};
    var me   = h.findMe();
    var priv = state._private || {};

    if (state.phase === "lobby") {
      showScreen(h, "sp-play");
      h.$("spRoleHeader").textContent = "En attente du demarrage (3 joueurs min)";
      h.$("spRoleBox").innerHTML = "";
      h.$("spHint").textContent = "";
      h.$("spTargets").innerHTML = "";
      h.$("spStatus").textContent = "";
      return;
    }

    if (state.phase === "playing") {
      showScreen(h, "sp-play");
      var role = priv.role || "";
      if (role === "spy") {
        h.$("spRoleHeader").textContent = "Ton role :";
        h.$("spRoleBox").innerHTML = '<div style="font-size:2rem">🕶️ ESPION</div><div class="muted" style="margin-top:6px;font-size:0.9rem">Tu ne connais pas le lieu. Bluff.</div>';
        h.$("spHint").textContent = "Devine le lieu sans te trahir. Si on vote pour toi, civils gagnent.";
      } else if (role === "spectator") {
        h.$("spRoleHeader").textContent = "Tu observes ce tour :";
        h.$("spRoleBox").innerHTML = '<div style="font-size:1.2rem">🍿 Spectateur</div>';
        h.$("spHint").textContent = "Tu as rejoint en cours, attends le prochain tour.";
      } else {
        h.$("spRoleHeader").textContent = "Lieu secret :";
        h.$("spRoleBox").innerHTML = '<div style="font-size:1.6rem;font-weight:700">' + h.escapeHtml(priv.location || "(privé)") + '</div>';
        h.$("spHint").textContent = "Reponds aux questions sans donner trop d\'indices a l'espion.";
      }

      var locked = !!(me && me.answered);
      var targets = h.$("spTargets");
      targets.innerHTML = "";
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
          h.$("spStatus").textContent = "Vote envoye, attends les autres...";
          h.send({ t: "vote", target_id: p.id });
        };
        targets.appendChild(btn);
      });
      h.$("spStatus").textContent = locked
        ? "Vote envoye, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " vote(s)") : "");
      return;
    }

    if (state.phase === "reveal") {
      showScreen(h, "sp-reveal");
      h.$("spWinner").innerHTML = (r.winner === "civilians" ? "🎉 Civils gagnent !" : "🕶️ L'espion gagne !");
      h.$("spLocR").textContent  = r.location || "?";
      h.$("spSpyR").textContent  = r.spy_name || "?";
      var ol = h.$("spVotes"); ol.innerHTML = "";
      var sorted = (r.votes || []).slice().sort(function (a, b) { return b.count - a.count; });
      sorted.forEach(function (v) {
        var spy = (v.name === r.spy_name);
        var li = document.createElement("li");
        li.innerHTML = "<span>" + (spy ? "🕶️ " : "") + h.escapeHtml(v.name) + "</span><b>" + v.count + "</b>";
        ol.appendChild(li);
      });
      h.$("spNextBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.GamesHub.register("spyfall", {
    name:   "Spyfall",
    emoji:  "🕶️",
    desc:   "Tous connaissent le lieu, sauf l'espion. (3 joueurs min)",
    mount:  build,
    render: render
  });
})();
