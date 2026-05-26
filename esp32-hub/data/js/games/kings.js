// Kings — shared deck, each card has a rule, 4th king ends the round.

(function () {
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="kg-main">' +
        '<div class="muted center" id="kgMeta" style="margin-bottom:6px"></div>' +
        '<div class="center" id="kgTurnTitle" style="font-size:1.2rem;margin-bottom:10px"></div>' +
        '<div id="kgCard" style="background:#1b1d35;border-radius:14px;padding:18px;text-align:center;margin-bottom:12px;min-height:120px;display:flex;align-items:center;justify-content:center;flex-direction:column"></div>' +
        '<div id="kgActions"></div>' +
        '<div class="center muted" id="kgHint" style="margin-top:10px"></div>' +
      '</div>';
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();
    var amCurrent = !!(me && r.current_id !== undefined && me.id === r.current_id);

    h.$("kgMeta").textContent = "Round #" + (r.round_n || 0) + " · " + (r.deck_left || 0) + " carte(s) · Rois " + (r.kings_drawn || 0) + "/4";

    if (state.phase === "lobby") {
      h.$("kgTurnTitle").textContent = "En attente du demarrage";
      h.$("kgCard").innerHTML = '<div class="muted">Le deck sera melange au demarrage</div>';
      h.$("kgActions").innerHTML = "";
      h.$("kgHint").textContent = "";
      return;
    }

    if (state.phase === "playing") {
      h.$("kgTurnTitle").textContent = amCurrent ? "🎴 C'est ton tour" : "Au tour de " + (r.current_name || "?");
      if (r.card) {
        var bigSuit = r.suit || "";
        h.$("kgCard").innerHTML =
          '<div style="font-size:2.6rem;font-weight:700">' + h.escapeHtml(r.card) + ' ' + h.escapeHtml(bigSuit) + '</div>' +
          '<div class="muted" style="margin-top:10px">' + h.escapeHtml(r.rule || "") + '</div>';
      } else {
        h.$("kgCard").innerHTML = '<div style="font-size:3rem">🂠</div><div class="muted" style="margin-top:8px">Le deck attend...</div>';
      }
      h.$("kgActions").innerHTML = "";
      if (amCurrent) {
        var btn = document.createElement("button");
        btn.className = "primary";
        btn.style.width = "100%";
        btn.textContent = r.card ? "Fin du tour ➜" : "🃏 Tirer une carte";
        btn.onclick = function () {
          btn.disabled = true;  // anti-double-tap, next render rebuilds
          h.send({ t: r.card ? "end_turn" : "draw" });
        };
        h.$("kgActions").appendChild(btn);
        h.$("kgHint").textContent = r.card ? "Applique la regle, puis passe au suivant." : "Tire ta carte !";
      } else {
        h.$("kgHint").textContent = r.card ? (h.escapeHtml(r.current_name) + " applique la regle...") : (h.escapeHtml(r.current_name) + " va tirer...");
      }
      return;
    }

    if (state.phase === "finished") {
      h.$("kgTurnTitle").textContent = "👑 Coupe Royale !";
      h.$("kgCard").innerHTML =
        '<div style="font-size:2rem">👑 4 rois tires !</div>' +
        '<div class="muted" style="margin-top:8px">' +
          (r.royal_cup ? '<b>' + h.escapeHtml(r.royal_cup) + '</b> boit la Coupe Royale 🍻' : 'Coupe royale !') +
        '</div>';
      h.$("kgActions").innerHTML = "";
      if (h.amHost()) {
        var btn = document.createElement("button");
        btn.className = "primary";
        btn.style.width = "100%";
        btn.textContent = "Nouveau round";
        btn.onclick = function () { h.send({ t: "next" }); };
        h.$("kgActions").appendChild(btn);
      }
      h.$("kgHint").textContent = "";
    }
  }

  window.GamesHub.register("kings", {
    name:   "Roi des Bieres",
    emoji:  "👑",
    desc:   "Tire une carte, applique la regle, passe au suivant.",
    rules:  "Un <b>deck de 52 cartes</b> partage par le groupe. Chacun pioche a son tour.<br>" +
            "Chaque carte declenche une <b>regle a appliquer</b> : As=Cascade, 2=Tu choisis qui bois, 3=Bois toi, " +
            "5=Pouce, Valet=Regle, Reine=Question, Roi=Coupe royale...<br>" +
            "Quand le <b>4eme Roi</b> est tire = celui qui l'a pioche boit la <b>Coupe Royale 🍻</b>. Fin de partie !",
    mount:  build,
    render: render
  });
})();
