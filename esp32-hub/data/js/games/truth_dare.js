// "Action ou Verite" — turn rotation; spotlighted player picks truth/dare.
// Everyone else sees "C'est au tour de X".

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="td-main">' +
        '<h2 class="center" id="tdTurnTitle"></h2>' +
        '<div class="muted center" id="tdTurnCount" style="margin-bottom:14px"></div>' +
        '<div id="tdChoice" class="screen on">' +
          '<button class="b" id="tdTruth" style="width:100%;margin:6px 0;font-size:1.2rem;min-height:80px">🤐 Verite</button>' +
          '<button class="a" id="tdDare"  style="width:100%;margin:6px 0;font-size:1.2rem;min-height:80px">😤 Action</button>' +
        '</div>' +
        '<div id="tdPromptBox" class="screen">' +
          '<div id="tdChoiceLabel" class="center muted" style="margin-bottom:6px"></div>' +
          '<div class="q center" id="tdPrompt" style="background:#1b1d35;border-radius:12px;padding:18px;min-height:90px;display:flex;align-items:center;justify-content:center"></div>' +
          '<button class="primary" id="tdDoneBtn" style="margin-top:14px;display:none">Fait !</button>' +
        '</div>' +
        '<div class="center muted" id="tdSpectator" style="margin-top:12px;display:none"></div>' +
      '</div>';

    h.$("tdTruth").onclick = function () { h.send({ t: "choose", value: "truth" }); };
    h.$("tdDare").onclick  = function () { h.send({ t: "choose", value: "dare"  }); };
    h.$("tdDoneBtn").onclick = function () { h.send({ t: "done" }); };
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();
    var isMyTurn = !!(me && r.current_id !== undefined && me.id === r.current_id);

    h.$("tdTurnCount").textContent = r.turn ? ("Tour #" + r.turn) : "";

    if (state.phase !== "playing" || !r.current_name) {
      h.$("tdTurnTitle").textContent = "Action ou Verite";
      h.$("tdChoice").classList.remove("on");
      h.$("tdPromptBox").classList.remove("on");
      h.$("tdSpectator").style.display = "block";
      h.$("tdSpectator").textContent = "En attente du demarrage...";
      return;
    }

    if (isMyTurn) {
      h.$("tdTurnTitle").textContent = "🎯 C'est ton tour !";
      h.$("tdSpectator").style.display = "none";
      if (r.choice) {
        h.$("tdChoice").classList.remove("on");
        h.$("tdPromptBox").classList.add("on");
        h.$("tdChoiceLabel").textContent = (r.choice === "truth" ? "🤐 Verite" : "😤 Action");
        h.$("tdPrompt").textContent = r.prompt || "...";
        h.$("tdDoneBtn").style.display = "block";
      } else {
        h.$("tdChoice").classList.add("on");
        h.$("tdPromptBox").classList.remove("on");
      }
    } else {
      h.$("tdTurnTitle").textContent = "Au tour de " + r.current_name;
      h.$("tdChoice").classList.remove("on");
      if (r.choice) {
        h.$("tdPromptBox").classList.add("on");
        h.$("tdChoiceLabel").textContent = r.current_name + " a choisi : " + (r.choice === "truth" ? "🤐 Verite" : "😤 Action");
        h.$("tdPrompt").textContent = r.prompt || "...";
        h.$("tdDoneBtn").style.display = "none";
      } else {
        h.$("tdPromptBox").classList.remove("on");
      }
      h.$("tdSpectator").style.display = "block";
      h.$("tdSpectator").textContent = r.choice
        ? "Regarde " + r.current_name + " s'executer !"
        : r.current_name + " choisit...";
    }
  }

  window.GamesHub.register("truth_dare", {
    name:   "Action ou Verite",
    emoji:  "🎭",
    desc:   "Tour par tour : verite ou gage, prompts piochés au hasard.",
    rules:  "Action ou Verite, en <b>tour rotatif</b>.<br>" +
            "<b>1.</b> Un joueur est mis en avant (les autres voient \"C'est au tour de X\").<br>" +
            "<b>2.</b> Il/elle choisit <b>🤐 Verite</b> (question) ou <b>😤 Action</b> (gage).<br>" +
            "<b>3.</b> Le prompt est tire au hasard et s'affiche pour tout le monde.<br>" +
            "<b>4.</b> Quand c'est fait, le joueur clique <b>Fait !</b> et on passe au suivant.",
    mount:  build,
    render: render
  });
})();
