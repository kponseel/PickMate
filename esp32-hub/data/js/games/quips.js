// Quips — Jackbox style. 2 contestants per round, room votes the funnier line.

(function () {
  var lastRoundN = -1;
  function build(area, h) {
    area.innerHTML =
      '<div class="screen on" id="qp-state">' +
        '<div class="muted center" id="qpRound"></div>' +
        '<div class="q center" id="qpPrompt" style="background:#1b1d35;border-radius:12px;padding:16px;margin:8px 0 14px"></div>' +
        // Contestant submit
        '<div id="qpSubmitBox" class="screen">' +
          '<input id="qpInput" placeholder="Ta meilleure punchline (47 char max)" maxlength="47" autocomplete="off">' +
          '<button class="primary" id="qpSubmitBtn" style="margin-top:10px">Envoyer</button>' +
        '</div>' +
        // Wait for both contestants
        '<div id="qpWait" class="screen">' +
          '<div class="center muted" id="qpWaitMsg"></div>' +
        '</div>' +
        // Vote
        '<div id="qpVote" class="screen">' +
          '<div class="muted center" style="margin-bottom:6px">Quelle vanne est la meilleure ?</div>' +
          '<button class="b" id="qpVoteA" style="width:100%;margin:6px 0;font-size:1rem;min-height:80px"></button>' +
          '<button class="c" id="qpVoteB" style="width:100%;margin:6px 0;font-size:1rem;min-height:80px"></button>' +
          '<div class="center muted" id="qpVoteStatus" style="margin-top:8px"></div>' +
        '</div>' +
        // Reveal
        '<div id="qpReveal" class="screen">' +
          '<div class="center" id="qpWinnerHeader" style="font-size:1.2rem;margin-bottom:10px"></div>' +
          '<div id="qpReA" style="background:#1b1d35;border-radius:10px;padding:12px;margin-bottom:8px"></div>' +
          '<div id="qpReB" style="background:#1b1d35;border-radius:10px;padding:12px;margin-bottom:14px"></div>' +
          '<button class="primary" id="qpNextBtn" style="display:none">Round suivant</button>' +
        '</div>' +
      '</div>';

    h.$("qpSubmitBtn").onclick = function () {
      var v = h.$("qpInput").value.trim();
      if (!v) return;
      h.$("qpSubmitBtn").disabled = true;
      h.$("qpInput").disabled = true;
      h.send({ t: "submit", text: v.substring(0, 47) });
    };
    h.$("qpVoteA").onclick = function () {
      h.$("qpVoteA").disabled = true; h.$("qpVoteB").disabled = true;
      h.$("qpVoteStatus").textContent = "Vote envoyé...";
      h.send({ t: "vote", value: 0 });
    };
    h.$("qpVoteB").onclick = function () {
      h.$("qpVoteA").disabled = true; h.$("qpVoteB").disabled = true;
      h.$("qpVoteStatus").textContent = "Vote envoyé...";
      h.send({ t: "vote", value: 1 });
    };
    h.$("qpNextBtn").onclick = function () { h.send({ t: "next" }); };
  }

  function sub(h, id) {
    ["qpSubmitBox", "qpWait", "qpVote", "qpReveal"].forEach(function (s) {
      h.$(s).classList.toggle("on", s === id);
    });
  }

  function render(state, h) {
    var r  = state.round || {};
    var me = h.findMe();

    h.$("qpRound").textContent = r.round_n ? ("Round #" + r.round_n) : "";
    h.$("qpPrompt").textContent = r.prompt || "(en attente)";

    if (state.phase === "lobby" || !r.prompt) {
      sub(h, "qpWait");
      h.$("qpWaitMsg").textContent = "En attente du demarrage...";
      return;
    }

    var amA = !!(me && r.contestant_a_id !== undefined && me.id === r.contestant_a_id);
    var amB = !!(me && r.contestant_b_id !== undefined && me.id === r.contestant_b_id);
    var amContestant = amA || amB;

    if (state.phase === "playing" && r.step === "submit") {
      // New round? Reset the input.
      if (r.round_n !== lastRoundN) {
        h.$("qpInput").value = "";
        lastRoundN = r.round_n;
      }
      if (amContestant) {
        var iSubmitted = (amA && r.submitted_a) || (amB && r.submitted_b);
        if (iSubmitted) {
          sub(h, "qpWait");
          h.$("qpWaitMsg").textContent = "✅ Punchline envoyée. En attente de l'autre contestant.";
        } else {
          sub(h, "qpSubmitBox");
          h.$("qpInput").disabled     = false;
          h.$("qpSubmitBtn").disabled = false;
        }
      } else {
        sub(h, "qpWait");
        h.$("qpWaitMsg").textContent = "🎤 " + (r.contestant_a_name || "?") + " et " + (r.contestant_b_name || "?") + " ecrivent... (" + (r.submitted || 0) + "/2)";
      }
      return;
    }

    if (state.phase === "playing" && r.step === "vote") {
      if (amContestant) {
        sub(h, "qpWait");
        h.$("qpWaitMsg").textContent = "Les autres votent... 🍿 " + (r.voted || 0) + "/" + (r.voters || 0);
        return;
      }
      sub(h, "qpVote");
      h.$("qpVoteA").textContent = "A: " + (r.answer_a || "...");
      h.$("qpVoteB").textContent = "B: " + (r.answer_b || "...");
      var locked = !!(me && me.answered);
      h.$("qpVoteA").disabled = locked;
      h.$("qpVoteB").disabled = locked;
      h.$("qpVoteStatus").textContent = locked
        ? "Vote envoyé, attends les autres..."
        : ((r.voted || 0) + "/" + (r.voters || 0) + " vote(s)");
      return;
    }

    if (state.phase === "reveal") {
      sub(h, "qpReveal");
      var winnerStr =
        r.winner === "a" ? "🏆 " + (r.contestant_a_name || "A") + " gagne !" :
        r.winner === "b" ? "🏆 " + (r.contestant_b_name || "B") + " gagne !" :
                           "🤝 Egalite !";
      h.$("qpWinnerHeader").textContent = winnerStr;
      h.$("qpReA").innerHTML = '<b>' + h.escapeHtml(r.contestant_a_name || "A") + '</b> (' + (r.votes_a || 0) + ') : ' + h.escapeHtml(r.answer_a || "");
      h.$("qpReB").innerHTML = '<b>' + h.escapeHtml(r.contestant_b_name || "B") + '</b> (' + (r.votes_b || 0) + ') : ' + h.escapeHtml(r.answer_b || "");
      h.$("qpNextBtn").style.display = h.amHost() ? "block" : "none";
    }
  }

  window.GamesHub.register("quips", {
    name:   "Vannes",
    emoji:  "🎤",
    desc:   "Deux contestants ecrivent la meilleure vanne, la salle vote.",
    rules:  "Style Jackbox.<br>" +
            "<b>1.</b> Un prompt s'affiche (\"La pire excuse pour annuler un RDV\"...).<br>" +
            "<b>2.</b> <b>2 contestants</b> sont tires au hasard. Ils tapent leur <b>punchline</b> (47 char max).<br>" +
            "<b>3.</b> Les autres votent <b>A ou B</b>, anonymement.<br>" +
            "<b>4.</b> Le gagnant marque des points. Ca rote a chaque round.",
    mount:  build,
    render: render
  });
})();
