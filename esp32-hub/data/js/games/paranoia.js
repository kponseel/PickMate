// Paranoia — one player whispers a question; they point at someone; a coin
// flip decides whether the question is revealed to the room.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="pa-main">' +
        '<h2 class="center" id="paTitle"></h2>' +
        '<div class="muted center" id="paTurn" style="margin-bottom:14px"></div>' +
        '<div id="paAsk" class="screen">' +
          '<div class="q center" style="background:#1b1d35;border-radius:12px;padding:18px;margin-bottom:14px" id="paPrompt"></div>' +
          '<div class="muted center" style="margin-bottom:8px">Choisis discretement la personne dont tu penses qu\'elle correspond le mieux. Personne ne verra qui tu choisis.</div>' +
          '<div id="paTargets"></div>' +
        '</div>' +
        '<div id="paWait" class="screen">' +
          '<div class="big">&#9203;</div>' +
          '<div class="center" id="paWaitMsg"></div>' +
        '</div>' +
        '<div id="paReveal" class="screen">' +
          '<div class="big" id="paRevealMark"></div>' +
          '<div class="center" id="paRevealMsg" style="font-size:1.15rem"></div>' +
          '<div id="paPromptR" class="q center" style="background:#1b1d35;border-radius:12px;padding:18px;margin-top:12px;display:none"></div>' +
          '<button class="primary" id="paNextBtn" style="display:none;margin-top:14px">Au suivant</button>' +
        '</div>' +
      '</div>';

    h.$("paNextBtn").onclick = function () { h.send({ t: "next" }); };
  }

  function showSubScreen(h, id) {
    ["paAsk", "paWait", "paReveal"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r       = state.round || {};
    var me      = h.findMe();
    var priv    = state._private || {};
    var iAmAsker = !!(me && r.whisperer_id !== undefined && me.id === r.whisperer_id);

    h.$("paTurn").textContent = r.turn ? ("Tour #" + r.turn) : "";

    if (state.phase === "lobby" || !r.whisperer_name) {
      h.$("paTitle").textContent = "Paranoia 👀";
      showSubScreen(h, "");
      return;
    }

    if (state.phase === "playing") {
      if (iAmAsker) {
        h.$("paTitle").textContent = "🤫 C'est ton tour";
        showSubScreen(h, "paAsk");
        h.$("paPrompt").textContent = priv.prompt || "(question privee — recharge si vide)";
        var targets = h.$("paTargets");
        targets.innerHTML = "";
        state.players.filter(function (p) { return p.connected; }).forEach(function (p) {
          var btn = document.createElement("button");
          btn.className = "ghost";
          btn.style.margin = "4px 0";
          btn.style.width  = "100%";
          btn.innerHTML = (p.host ? '<span class="crown">&#x1F451;</span> ' : '') + h.escapeHtml(p.name);
          btn.onclick = function () {
            targets.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
            h.send({ t: "point", target_id: p.id });
          };
          targets.appendChild(btn);
        });
      } else {
        h.$("paTitle").textContent = "👀 " + r.whisperer_name + " choisit...";
        showSubScreen(h, "paWait");
        h.$("paWaitMsg").textContent = r.whisperer_name + " a recu une question privee et pointe discretement quelqu'un. Tu sauras qui (mais peut-etre pas pourquoi)...";
      }
      return;
    }

    if (state.phase === "reveal") {
      h.$("paTitle").textContent = "🎯 Verdict !";
      showSubScreen(h, "paReveal");
      var coin = r.coin || "sealed";
      var amAccused = !!(me && r.accused_id !== undefined && me.id === r.accused_id);
      h.$("paRevealMark").innerHTML = amAccused ? "&#x1F3AF;" : (coin === "open" ? "&#x1F513;" : "&#x1F512;");
      h.$("paRevealMsg").innerHTML  = (r.whisperer_name || "?") + " a pointe <b>" + h.escapeHtml(r.accused_name || "?") + "</b>";
      if (coin === "open" && r.prompt) {
        h.$("paPromptR").style.display = "block";
        h.$("paPromptR").textContent = "La question etait : " + r.prompt;
      } else {
        h.$("paPromptR").style.display = "block";
        h.$("paPromptR").textContent = "🤐 La piece a decide : la question reste secrete.";
      }
      h.$("paNextBtn").style.display = h.amHost() ? "block" : "none";
      return;
    }
  }

  window.GamesHub.register("paranoia", {
    name:   "Paranoia",
    emoji:  "👀",
    desc:   "Question secrete a une personne. Le doigt parle... le coin decide.",
    rules:  "<b>1.</b> Un seul joueur recoit une <b>question privee</b> sur son tel (les autres ne voient rien).<br>" +
            "<b>2.</b> Il/elle pointe discretement la personne qui colle le mieux a la question.<br>" +
            "<b>3.</b> Tout le groupe voit <b>qui</b> a ete pointe — sans savoir pourquoi.<br>" +
            "<b>4.</b> Le <b>coin 🪙</b> est tire : 50% chance que la question soit revelee, 50% qu'elle reste mystere.<br>" +
            "Tour rotatif. Reste paranoiaque ! 👀",
    mount:  build,
    render: render
  });
})();
