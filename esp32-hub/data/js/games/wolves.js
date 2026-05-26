// Wolves — simplified Werewolf. Night = wolves pick; day = village votes.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="wo-main">' +
        '<div class="muted center" id="woMeta"></div>' +
        '<h2 class="center" id="woPhaseTitle" style="margin:6px 0 12px"></h2>' +
        '<div id="woRoleBox" style="background:#1b1d35;border-radius:12px;padding:14px;text-align:center;margin-bottom:14px"></div>' +
        '<div id="woAllies" class="muted center" style="margin-bottom:8px"></div>' +
        '<div class="muted center" id="woHint" style="margin-bottom:8px"></div>' +
        '<div id="woTargets"></div>' +
        '<div id="woResult" style="margin-top:14px"></div>' +
        '<button class="primary" id="woNextBtn" style="display:none;margin-top:12px">Continuer</button>' +
      '</div>';

    h.$("woNextBtn").onclick = function () { h.send({ t: "next" }); };
  }

  function setRoleBox(h, body) { h.$("woRoleBox").innerHTML = body; }

  function render(state, h) {
    var r    = state.round || {};
    var me   = h.findMe();
    var priv = state._private || {};

    h.$("woMeta").textContent = "Round #" + (r.round_n || 0) +
      "  · 🧑‍🤝‍🧑 " + (r.alive_villagers || 0) + " villageois · 🐺 " + (r.alive_wolves || 0) + " loup(s)";

    if (state.phase === "lobby") {
      h.$("woPhaseTitle").textContent = "En attente (4 joueurs min)";
      setRoleBox(h, '<div class="muted">Les rôles seront tirés au demarrage. 7+ joueurs = 2 loups.</div>');
      h.$("woAllies").textContent = "";
      h.$("woHint").textContent = "";
      h.$("woTargets").innerHTML = "";
      h.$("woResult").innerHTML = "";
      h.$("woNextBtn").style.display = "none";
      return;
    }

    var role = priv.role || "";
    var roleHtml =
      role === "wolf"      ? '<div style="font-size:1.6rem">🐺 Tu es LOUP</div><div class="muted">Reste discret le jour.</div>' :
      role === "villager"  ? '<div style="font-size:1.6rem">🧑‍🌾 Tu es VILLAGEOIS</div><div class="muted">Demasque les loups.</div>' :
      role === "eliminated"? '<div style="font-size:1.4rem">💀 Tu es ELIMINE</div><div class="muted">Observe la suite.</div>' :
      role === "spectator" ? '<div style="font-size:1.2rem">🍿 Spectateur</div><div class="muted">Pas dans ce match.</div>' :
                             '<div class="muted">(rôle privé en attente)</div>';
    setRoleBox(h, roleHtml);

    if (role === "wolf" && priv.allies && priv.allies.length > 1) {
      h.$("woAllies").innerHTML = "Tes alliés loups : <b>" + priv.allies.map(h.escapeHtml).join(", ") + "</b>";
    } else {
      h.$("woAllies").textContent = "";
    }

    h.$("woResult").innerHTML = "";
    h.$("woTargets").innerHTML = "";
    h.$("woNextBtn").style.display = "none";

    if (state.phase === "playing") {
      var step = r.step;
      h.$("woPhaseTitle").textContent = (step === "night") ? "🌙 La nuit tombe" : "☀️ Le jour se leve";
      var locked = !!(me && me.answered);

      if (priv.can_vote) {
        h.$("woHint").textContent = (step === "night")
          ? "Loup·ve, choisis ta victime :"
          : "Village, vote qui eliminer :";
        var targets = h.$("woTargets");
        (priv.voteable || []).forEach(function (t) {
          var btn = document.createElement("button");
          btn.className = "ghost";
          btn.style.margin = "4px 0";
          btn.style.width  = "100%";
          btn.disabled = locked;
          btn.textContent = t.name;
          btn.onclick = function () {
            targets.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
            h.send({ t: "vote", target_id: t.id });
          };
          targets.appendChild(btn);
        });
        if (locked) h.$("woHint").textContent = "Vote enregistré (" + (r.voted || 0) + "/" + (r.voters || 0) + ")";
      } else {
        h.$("woHint").textContent = (step === "night")
          ? "🤫 Les loups choisissent..."
          : (role === "eliminated" || role === "spectator")
              ? "Tu n'as pas de vote ce tour."
              : "Attends le tour du village.";
      }
      return;
    }

    if (state.phase === "reveal") {
      h.$("woPhaseTitle").textContent = (r.kill_type === "night") ? "🌙 La nuit a fait une victime..." : "☀️ Le village a tranche...";
      if (r.victim_name) {
        h.$("woResult").innerHTML =
          '<div style="background:#1b1d35;border-radius:12px;padding:14px;text-align:center">' +
            '<div style="font-size:1.4rem">💀 <b>' + h.escapeHtml(r.victim_name) + '</b></div>' +
            '<div class="muted">Etait : <b>' + h.escapeHtml(r.victim_role || "?") + '</b></div>' +
          '</div>';
      } else {
        h.$("woResult").innerHTML = '<div class="muted center">Pas de victime cette fois.</div>';
      }
      h.$("woNextBtn").style.display = h.amHost() ? "block" : "none";
      return;
    }

    if (state.phase === "finished") {
      h.$("woPhaseTitle").textContent = (r.winner === "villagers") ? "🎉 Le village gagne !" : "🐺 Les loups gagnent !";
      var roster = r.roster || [];
      var html = '<div class="muted">Roster final :</div><ol>';
      roster.forEach(function (p) {
        var em = (p.role === "loup") ? "🐺" : "🧑‍🌾";
        html += '<li><span>' + em + ' ' + h.escapeHtml(p.name) + '</span><b>' + (p.alive ? '✅ survit' : '💀 mort') + '</b></li>';
      });
      html += '</ol>';
      h.$("woResult").innerHTML = html;
      h.$("woNextBtn").style.display = h.amHost() ? "block" : "none";
      h.$("woNextBtn").textContent = "Nouvelle partie";
    }
  }

  window.GamesHub.register("wolves", {
    name:   "Loups",
    emoji:  "🐺",
    desc:   "Werewolf simplifie. 4 joueurs min. 7+ = 2 loups.",
    rules:  "<b>Loup-Garou simplifie.</b> 4 joueurs min. 1 loup si &lt;7, <b>2 loups</b> si 7+.<br>" +
            "<b>🌙 Nuit :</b> les loups voient qui sont leurs allies et choisissent une victime (vote prive).<br>" +
            "<b>☀️ Jour :</b> tout le village discute (a l'oral) puis vote qui eliminer.<br>" +
            "<b>Fin :</b> les villageois gagnent en eliminant <b>tous les loups</b>. Les loups gagnent quand ils sont <b>aussi nombreux</b> que les villageois.",
    mount:  build,
    render: render
  });
})();
