// Dares — random dare picker.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on">' +
        '<div class="muted center" id="dgRound"></div>' +
        '<div class="big center" style="margin:14px 0">🎲</div>' +
        '<div class="q center" id="dgTitle" style="margin-bottom:10px"></div>' +
        '<div id="dgDare" style="background:#1b1d35;border-radius:12px;padding:18px;min-height:90px;font-size:1.05rem;text-align:center"></div>' +
        '<div id="dgActions" style="margin-top:14px"></div>' +
      '</div>';
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();
    var amPicked = !!(me && r.picked_id !== undefined && me.id === r.picked_id);

    h.$("dgRound").textContent = r.round_n ? "Round #" + r.round_n : "";

    if (state.phase === "lobby" || !r.picked_name) {
      h.$("dgTitle").textContent = "En attente du demarrage";
      h.$("dgDare").textContent  = "Clique \"Demarrer\" pour piocher la premiere victime";
      h.$("dgActions").innerHTML = "";
      return;
    }

    h.$("dgTitle").innerHTML  = amPicked ? "🎯 C'est ton gage !" : "🎯 Pour : <b>" + h.escapeHtml(r.picked_name) + "</b>";
    h.$("dgDare").textContent = r.dare || "...";

    h.$("dgActions").innerHTML = "";
    if (amPicked) {
      var btn = document.createElement("button");
      btn.className = "primary";
      btn.style.width = "100%";
      btn.textContent = "Fait ! ➜ piocher le suivant";
      btn.onclick = function () { h.send({ t: "done" }); };
      h.$("dgActions").appendChild(btn);
    } else if (h.amHost()) {
      var btn = document.createElement("button");
      btn.className = "ghost";
      btn.style.width = "100%";
      btn.textContent = "Passer (hote)";
      btn.onclick = function () { h.send({ t: "next" }); };
      h.$("dgActions").appendChild(btn);
    }
  }

  window.GamesHub.register("dares", {
    name:   "Gages",
    emoji:  "🎲",
    desc:   "Gage aleatoire pour un joueur aleatoire.",
    mount:  build,
    render: render
  });
})();
