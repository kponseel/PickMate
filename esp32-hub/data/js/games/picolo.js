// Picolo — escalating prompts, host advances.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on">' +
        '<div class="muted center" id="piMeta"></div>' +
        '<div class="big center" style="margin:14px 0">🍻</div>' +
        '<div id="piPrompt" style="background:#1b1d35;border-radius:14px;padding:20px;min-height:120px;font-size:1.1rem;line-height:1.5;text-align:center"></div>' +
        '<div id="piActions" style="margin-top:14px"></div>' +
      '</div>';
  }

  function render(state, h) {
    var r = state.round || {};
    h.$("piMeta").textContent = (state.phase === "playing")
      ? "Prompt " + ((r.idx || 0) + 1) + " / " + (r.total || "?")
      : (state.phase === "finished" ? "Termine 🎉" : "En attente du demarrage");

    if (state.phase === "lobby") {
      h.$("piPrompt").textContent = "Clique \"Demarrer\" pour commencer la partie.";
    } else if (state.phase === "playing") {
      h.$("piPrompt").textContent = r.prompt || "...";
    } else {
      h.$("piPrompt").textContent = "Plus de prompts dans la liste — recommence ou ajoute en !";
    }

    h.$("piActions").innerHTML = "";
    if (h.amHost()) {
      var btn = document.createElement("button");
      btn.className = "primary";
      btn.style.width = "100%";
      btn.textContent = state.phase === "lobby" ? "Demarrer" : (state.phase === "finished" ? "Recommencer" : "Prompt suivant ➜");
      btn.onclick = function () { h.send({ t: state.phase === "finished" ? "reset" : "next" }); };
      h.$("piActions").appendChild(btn);
    }
  }

  window.GamesHub.register("picolo", {
    name:   "Picolo",
    emoji:  "🍻",
    desc:   "Prompts escalades avec les prenoms du groupe.",
    mount:  build,
    render: render
  });
})();
