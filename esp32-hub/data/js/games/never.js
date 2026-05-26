// "Je n'ai jamais..." — anonymous binary vote.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="nv-vote">' +
        '<div class="q" id="nvPrompt"></div>' +
        '<button class="a" id="nvHave"  style="margin:6px 0;width:100%">J\'ai deja</button>' +
        '<button class="d" id="nvNever" style="margin:6px 0;width:100%">Jamais</button>' +
        '<div class="center muted" id="nvStatus"></div>' +
      '</div>' +
      '<div class="screen" id="nv-reveal">' +
        '<h2 class="center">Resultats</h2>' +
        '<div class="center muted" id="nvPromptR" style="margin-bottom:14px"></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div style="background:#1b1d35;padding:18px;border-radius:12px;text-align:center">' +
            '<div class="muted">J\'ai deja</div>' +
            '<div style="font-size:2.4rem;color:#e6394a;font-weight:700" id="nvHaveCnt">0</div>' +
          '</div>' +
          '<div style="background:#1b1d35;padding:18px;border-radius:12px;text-align:center">' +
            '<div class="muted">Jamais</div>' +
            '<div style="font-size:2.4rem;color:#26890c;font-weight:700" id="nvNeverCnt">0</div>' +
          '</div>' +
        '</div>' +
        '<button class="primary" id="nvNextBtn" style="display:none;margin-top:14px">Question suivante</button>' +
      '</div>' +
      '<div class="screen" id="nv-end">' +
        '<h2 class="center">Termine !</h2>' +
        '<button class="primary" id="nvResetBtn" style="display:none">Recommencer</button>' +
      '</div>';

    h.$("nvHave").onclick = function () {
      var me = h.findMe(); if (me && me.answered) return;
      h.$("nvHave").disabled = true; h.$("nvNever").disabled = true;
      h.$("nvStatus").textContent = "Reponse envoyee...";
      h.send({ t: "answer", value: 0 });
    };
    h.$("nvNever").onclick = function () {
      var me = h.findMe(); if (me && me.answered) return;
      h.$("nvHave").disabled = true; h.$("nvNever").disabled = true;
      h.$("nvStatus").textContent = "Reponse envoyee...";
      h.send({ t: "answer", value: 1 });
    };
    h.$("nvNextBtn").onclick  = function () { h.send({ t: "next"  }); };
    h.$("nvResetBtn").onclick = function () { h.send({ t: "reset" }); };
  }

  function showScreen(h, id) {
    ["nv-vote", "nv-reveal", "nv-end"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();
    if (state.phase === "playing") {
      showScreen(h, "nv-vote");
      h.$("nvPrompt").textContent = "(" + ((r.idx || 0) + 1) + "/" + (r.total || "?") + ") " + (r.prompt || "");
      var locked = !!(me && me.answered);
      h.$("nvHave").disabled  = locked;
      h.$("nvNever").disabled = locked;
      h.$("nvStatus").textContent = locked
        ? "Reponse envoyee, attends les autres..."
        : (r.answered !== undefined ? (r.answered + " / " + state.players.length + " repondu(s)") : "");
    } else if (state.phase === "reveal") {
      showScreen(h, "nv-reveal");
      h.$("nvPromptR").textContent = r.prompt || "";
      h.$("nvHaveCnt").textContent  = r.have  || 0;
      h.$("nvNeverCnt").textContent = r.never || 0;
      h.$("nvNextBtn").style.display = h.amHost() ? "block" : "none";
    } else if (state.phase === "finished") {
      showScreen(h, "nv-end");
      h.$("nvResetBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.GamesHub.register("never", {
    name:   "Je n'ai jamais",
    emoji:  "🙊",
    desc:   "Anonyme : j'ai deja ou jamais ? On voit le score.",
    rules:  "Une phrase \"Je n'ai jamais...\" s'affiche.<br>" +
            "Chacun choisit <b>J'ai deja</b> ou <b>Jamais</b>.<br>" +
            "Le reveal montre uniquement les <b>compteurs</b> (totalement anonyme, sans nom).<br>" +
            "Le but : ambiance, decouvertes, et tu bois quand t'as deja fait 😉.",
    mount:  build,
    render: render
  });
})();
