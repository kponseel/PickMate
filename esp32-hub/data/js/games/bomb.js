// Bomb — hot potato with a hidden countdown.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="bm-main">' +
        '<div class="muted center" id="bmRound" style="margin-bottom:6px"></div>' +
        '<div class="big center" id="bmIcon" style="margin:14px 0">💣</div>' +
        '<div class="q center" id="bmHeader" style="margin-bottom:14px"></div>' +
        '<div id="bmTargets"></div>' +
        '<div class="center muted" id="bmHint" style="margin-top:14px"></div>' +
        '<button class="primary" id="bmNextBtn" style="display:none;margin-top:14px">Round suivant</button>' +
      '</div>';

    h.$("bmNextBtn").onclick = function () { h.send({ t: "next" }); };
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();
    var amHolder = !!(me && r.holder_id !== undefined && me.id === r.holder_id);

    h.$("bmRound").textContent = r.round_n ? ("Round #" + r.round_n) : "";

    if (state.phase === "lobby" || !r.holder_name) {
      h.$("bmIcon").textContent = "💣";
      h.$("bmHeader").textContent = "En attente du demarrage";
      h.$("bmTargets").innerHTML = "";
      h.$("bmHint").textContent = "";
      h.$("bmNextBtn").style.display = "none";
      return;
    }

    if (state.phase === "playing") {
      h.$("bmIcon").textContent = "💣";
      h.$("bmNextBtn").style.display = "none";
      if (amHolder) {
        h.$("bmHeader").innerHTML = "<b>Tu as la bombe !</b><br>Passe-la VITE !";
        var targets = h.$("bmTargets");
        targets.innerHTML = "";
        state.players.filter(function (p) { return p.connected && p.id !== me.id; }).forEach(function (p) {
          var btn = document.createElement("button");
          btn.className = "a";
          btn.style.margin = "4px 0";
          btn.style.width  = "100%";
          btn.textContent  = "Passer a " + p.name;
          btn.onclick = function () { h.send({ t: "pass", target_id: p.id }); };
          targets.appendChild(btn);
        });
        h.$("bmHint").textContent = "Le timer est cache. Ne traine pas...";
      } else {
        h.$("bmHeader").innerHTML = "La bombe est chez <b>" + h.escapeHtml(r.holder_name) + "</b>";
        h.$("bmTargets").innerHTML = "";
        h.$("bmHint").textContent = "Croise les doigts pour qu'il/elle la passe avant que ca explose !";
      }
      return;
    }

    if (state.phase === "reveal") {
      h.$("bmIcon").textContent = "💥";
      h.$("bmHeader").innerHTML = "<b>BOOM !</b><br>" + h.escapeHtml(r.boomed || "?") + " a explose !";
      var sb = r.scoreboard || [];
      if (sb.length) {
        var ol = document.createElement("ol");
        sb.sort(function (a, b) { return b.booms - a.booms; }).forEach(function (s) {
          var li = document.createElement("li");
          li.innerHTML = "<span>" + h.escapeHtml(s.name) + "</span><b>💥 " + s.booms + "</b>";
          ol.appendChild(li);
        });
        h.$("bmTargets").innerHTML = "<div class='muted'>Cumul des explosions :</div>";
        h.$("bmTargets").appendChild(ol);
      } else {
        h.$("bmTargets").innerHTML = "";
      }
      h.$("bmHint").textContent = "";
      h.$("bmNextBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.GamesHub.register("bomb", {
    name:   "La Bombe",
    emoji:  "💣",
    desc:   "Patate chaude avec timer cache. Refile-la !",
    rules:  "Une <b>bombe virtuelle</b> circule entre les tels.<br>" +
            "<b>Timer cache</b> de 20 a 60 secondes — personne ne sait quand ca explose.<br>" +
            "Si tu as la bombe : tape sur le nom d'un autre joueur pour <b>la lui passer</b>.<br>" +
            "<b>BOOM</b> quand le timer atteint 0 : celui qui la tient <b>perd la manche</b> (compteur 💥).<br>" +
            "L'hote relance un nouveau round.",
    mount:  build,
    render: render
  });
})();
