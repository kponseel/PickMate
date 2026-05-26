// Bluff — type a fake answer, then vote the real one out of the shuffled pool.

(function () {
  var lastQIdx = -1;
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="bl-submit">' +
        '<div class="muted center" id="blIdxS"></div>' +
        '<div class="q center" id="blQS" style="margin:6px 0 14px"></div>' +
        '<input id="blInput" placeholder="Ecris une fausse reponse credible" maxlength="31" autocomplete="off">' +
        '<button class="primary" id="blSubmitBtn" style="margin-top:10px">Envoyer</button>' +
        '<div class="center muted" id="blSubStatus" style="margin-top:10px"></div>' +
      '</div>' +
      '<div class="screen" id="bl-vote">' +
        '<div class="muted center" id="blIdxV"></div>' +
        '<div class="q center" id="blQV" style="margin:6px 0 14px"></div>' +
        '<div class="muted center" style="margin-bottom:6px">Vote pour la VRAIE reponse :</div>' +
        '<div id="blOptions"></div>' +
        '<div class="center muted" id="blVoteStatus" style="margin-top:10px"></div>' +
      '</div>' +
      '<div class="screen" id="bl-reveal">' +
        '<h2 class="center">📜 Reveal</h2>' +
        '<div class="muted center" style="margin:6px 0">La vraie reponse etait :</div>' +
        '<div class="q center" id="blReal" style="background:#26890c;border-radius:12px;padding:14px;font-weight:700;margin-bottom:14px"></div>' +
        '<div class="muted">Options :</div>' +
        '<ol id="blOptionsR" style="margin-top:6px"></ol>' +
        '<button class="primary" id="blNextBtn" style="display:none;margin-top:14px">Question suivante</button>' +
      '</div>' +
      '<div class="screen" id="bl-end">' +
        '<h2 class="center">Classement final</h2>' +
        '<ol id="blBoard"></ol>' +
        '<button class="primary" id="blResetBtn" style="display:none">Recommencer</button>' +
      '</div>';

    h.$("blSubmitBtn").onclick = function () {
      var v = h.$("blInput").value.trim();
      if (!v) return;
      h.$("blSubmitBtn").disabled = true;
      h.$("blInput").disabled     = true;
      h.$("blSubStatus").textContent = "Envoyé !";
      h.send({ t: "submit", text: v.substring(0, 31) });
    };
    h.$("blNextBtn").onclick  = function () { h.send({ t: "next"  }); };
    h.$("blResetBtn").onclick = function () { h.send({ t: "reset" }); };
  }

  function showScreen(h, id) {
    ["bl-submit", "bl-vote", "bl-reveal", "bl-end"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();

    if (state.phase === "lobby" || !r.q) {
      showScreen(h, "bl-submit");
      h.$("blQS").textContent = "(en attente du demarrage)";
      h.$("blIdxS").textContent = "";
      h.$("blInput").value = "";
      h.$("blInput").disabled = true;
      h.$("blSubmitBtn").disabled = true;
      return;
    }

    if (state.phase === "playing" && r.step === "submit") {
      showScreen(h, "bl-submit");
      // New round? Reset the input box so the previous fake doesn't linger.
      if (r.idx !== lastQIdx) {
        h.$("blInput").value = "";
        lastQIdx = r.idx;
      }
      h.$("blIdxS").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ")";
      h.$("blQS").textContent   = r.q;
      var locked = !!(me && me.answered);
      h.$("blInput").disabled     = locked;
      h.$("blSubmitBtn").disabled = locked;
      h.$("blSubStatus").textContent = locked
        ? "Réponse envoyée, attends les autres..."
        : "Inscris une fausse réponse crédible !";
      return;
    }

    if (state.phase === "playing" && r.step === "vote") {
      showScreen(h, "bl-vote");
      h.$("blIdxV").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ")";
      h.$("blQV").textContent   = r.q;
      var locked = !!(me && me.answered);
      var ul = h.$("blOptions");
      ul.innerHTML = "";
      (r.options || []).forEach(function (text, i) {
        var btn = document.createElement("button");
        btn.className = "ghost";
        btn.style.margin = "4px 0";
        btn.style.width  = "100%";
        btn.disabled = locked;
        btn.textContent = text;
        btn.onclick = function () {
          if (locked) return;
          ul.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
          h.$("blVoteStatus").textContent = "Vote envoyé...";
          h.send({ t: "vote", option: i });
        };
        ul.appendChild(btn);
      });
      h.$("blVoteStatus").textContent = locked
        ? "Vote envoyé, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " / " + r.players_active + " vote(s)") : "");
      return;
    }

    if (state.phase === "reveal") {
      showScreen(h, "bl-reveal");
      h.$("blReal").textContent = r.real_answer || "?";
      var ol = h.$("blOptionsR"); ol.innerHTML = "";
      (r.options || []).forEach(function (o) {
        var li = document.createElement("li");
        var label = o.real ? '<span style="color:#26890c">✅ ' + h.escapeHtml(o.text) + ' (VRAI)</span>' : h.escapeHtml(o.text);
        var owner = o.owner ? '<b style="color:#d89e00">' + h.escapeHtml(o.owner) + '</b>' : '<b style="color:#5b6cff">officielle</b>';
        li.innerHTML = '<span>' + label + '</span>' + owner;
        ol.appendChild(li);
      });
      h.$("blNextBtn").style.display = h.amHost() ? "block" : "none";
      return;
    }

    if (state.phase === "finished") {
      showScreen(h, "bl-end");
      var ol = h.$("blBoard"); ol.innerHTML = "";
      var sorted = state.players.slice().sort(function (a, b) { return b.score - a.score; });
      sorted.forEach(function (p, i) {
        var medal = (i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : "");
        var li = document.createElement("li");
        li.innerHTML = "<span>" + medal + (p.host ? '<span class="crown">&#x1F451;</span> ' : '') + h.escapeHtml(p.name) + "</span><b>" + p.score + "</b>";
        ol.appendChild(li);
      });
      h.$("blResetBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.GamesHub.register("bluff", {
    name:   "Le Bluff",
    emoji:  "🤥",
    desc:   "Question difficile : ecris une fausse reponse, vote la vraie.",
    rules:  "Une question <b>difficile</b> s'affiche (\"Quelle est la capitale du Kazakhstan ?\").<br>" +
            "<b>1.</b> Chacun tape une <b>fausse reponse plausible</b> (max 31 char).<br>" +
            "<b>2.</b> Toutes les fausses + la VRAIE sont melangees et affichees.<br>" +
            "<b>3.</b> Vote la <b>VRAIE</b> reponse.<br>" +
            "<b>Scoring :</b> +500 si tu trouves la vraie, +250 par joueur que ta fausse a piege.",
    mount:  build,
    render: render
  });
})();
