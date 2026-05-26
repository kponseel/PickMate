// Quiz — server-authoritative, ported from esp32-hub/src/games/quiz.cpp.
//
// This file is the reference for porting the other 15 games: copy the shape
// (a `create()` returning the hooks below) and translate the matching .cpp.
//
// Hook contract (mirror of games/game_api.h). Every hook receives the `room`
// (use room.players / room.activePlayers()); never broadcast yourself — the
// core does it after each hook and whenever tick() returns true.
//   phase()                  -> "lobby" | "playing" | "reveal" | "finished"
//   onSelect(room)           -> entered from the hub (reset)
//   onStart(room)            -> explicit start (optional)
//   onAdvance(room)          -> NEXT pressed (host / admin)
//   onReset(room)            -> full reset
//   onPlayerJoin(room, p)    -> optional
//   onPlayerLeave(room, p)   -> optional
//   onMessage(room, p, msg)  -> game-specific intent (server decides outcomes)
//   serializeRound(room)     -> object put in state.round
//   serializePrivate(room,p) -> per-player whisper, or null (optional)
//   tick(room, nowMs)        -> return true if state changed (timers)

const QUESTION_TIME_MS = 20000;

const QUESTIONS = [
  { text: "Quelle est la capitale de la France ?", options: ["Lyon", "Paris", "Marseille", "Nice"], correct: 1 },
  { text: "Combien font 7 × 8 ?", options: ["54", "56", "64", "48"], correct: 1 },
  { text: "Quel gaz les plantes absorbent-elles ?", options: ["Oxygène", "Azote", "CO₂", "Hélium"], correct: 2 },
  { text: "Quel est le plus grand océan ?", options: ["Atlantique", "Indien", "Arctique", "Pacifique"], correct: 3 },
  { text: "Combien de bits dans un octet ?", options: ["4", "8", "16", "32"], correct: 1 },
  { text: "Quelle est la capitale de l'Espagne ?", options: ["Lisbonne", "Madrid", "Athènes", "Rome"], correct: 1 },
  { text: "Quelle est la plus grosse planète du système solaire ?", options: ["Mars", "Saturne", "Jupiter", "Neptune"], correct: 2 },
  { text: "Combien y a-t-il de continents ?", options: ["4", "5", "6", "7"], correct: 3 },
  { text: "Quel animal a le plus long cou ?", options: ["Autruche", "Lama", "Girafe", "Flamant"], correct: 2 },
  { text: "Qui a peint la Joconde ?", options: ["Michel-Ange", "Raphaël", "Léonard de Vinci", "Picasso"], correct: 2 },
  { text: "Comment s'appelle un bébé chien ?", options: ["Chaton", "Chiot", "Faon", "Poulain"], correct: 1 },
  { text: "Quel est le plus grand désert chaud du monde ?", options: ["Gobi", "Kalahari", "Atacama", "Sahara"], correct: 3 },
  { text: "En quelle année est tombé le Mur de Berlin ?", options: ["1985", "1989", "1991", "1993"], correct: 1 },
  { text: "Combien de touches a un piano classique ?", options: ["76", "82", "88", "96"], correct: 2 },
  { text: "Quelle est la monnaie du Japon ?", options: ["Won", "Yuan", "Yen", "Baht"], correct: 2 },
  { text: "Quel est le plus haut sommet du monde ?", options: ["K2", "Mont Blanc", "Everest", "Kilimandjaro"], correct: 2 },
  { text: "Quel sport pratique Roger Federer ?", options: ["Golf", "Tennis", "Ski", "Basket"], correct: 1 },
  { text: "Combien de joueurs dans une équipe de foot ?", options: ["9", "10", "11", "12"], correct: 2 },
  { text: "Quelle est la capitale de l'Australie ?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], correct: 2 },
  { text: "Quel auteur a écrit « Les Misérables » ?", options: ["Zola", "Hugo", "Balzac", "Dumas"], correct: 1 },
  { text: "Combien d'os dans le corps humain adulte ?", options: ["186", "206", "256", "306"], correct: 1 },
  { text: "Quelle planète a des anneaux célèbres ?", options: ["Mars", "Jupiter", "Saturne", "Uranus"], correct: 2 },
  { text: "Quel est le pays le plus peuplé au monde ?", options: ["Chine", "Inde", "USA", "Indonésie"], correct: 1 },
  { text: "Combien de côtés a un hexagone ?", options: ["5", "6", "7", "8"], correct: 1 },
  { text: "Combien de cordes sur une guitare standard ?", options: ["4", "5", "6", "7"], correct: 2 },
];

function create() {
  let phase = "lobby";
  let currentQ = -1;
  let questionStart = 0;

  function startQuestion(room, idx) {
    currentQ = idx;
    phase = "playing";
    questionStart = Date.now();
    room.players.forEach((p) => {
      p.answered = false;
      p.answer = -1;
    });
  }

  function allAnswered(room) {
    const a = room.activePlayers();
    return a.length > 0 && a.every((p) => p.answered);
  }

  function doReveal(room) {
    if (phase !== "playing") return; // idempotent: timeout vs all-answered
    const correct = QUESTIONS[currentQ].correct;
    room.activePlayers().forEach((p) => {
      if (p.answered && p.answer === correct) {
        let frac = 1 - p.answerMs / QUESTION_TIME_MS;
        if (frac < 0) frac = 0;
        p.score += 500 + Math.round(500 * frac);
      }
    });
    phase = "reveal";
  }

  function resetAll(room) {
    phase = "lobby";
    currentQ = -1;
    room.players.forEach((p) => {
      p.score = 0;
      p.answered = false;
      p.answer = -1;
    });
  }

  return {
    phase: () => phase,
    onSelect: resetAll,
    onStart: (room) => { if (QUESTIONS.length) startQuestion(room, 0); },
    onAdvance: (room) => {
      if (phase === "lobby") { if (QUESTIONS.length) startQuestion(room, 0); }
      else if (phase === "playing") { doReveal(room); }
      else if (phase === "reveal") {
        if (currentQ + 1 < QUESTIONS.length) startQuestion(room, currentQ + 1);
        else phase = "finished";
      } else { resetAll(room); }
    },
    onReset: resetAll,
    onPlayerLeave: (room) => { if (phase === "playing" && allAnswered(room)) doReveal(room); },
    onMessage: (room, p, msg) => {
      if (!p || msg.t !== "answer") return;
      if (phase !== "playing" || p.answered) return;
      const choice = msg.choice;
      if (typeof choice !== "number" || choice < 0 || choice > 3) return;
      p.answered = true;
      p.answer = choice;
      p.answerMs = Date.now() - questionStart;
      if (allAnswered(room)) doReveal(room);
    },
    serializeRound: (room) => {
      const r = { total: QUESTIONS.length };
      if (currentQ < 0) return r;
      const q = QUESTIONS[currentQ];
      r.idx = currentQ;
      if (phase === "playing" || phase === "reveal") {
        r.q = q.text;
        r.options = q.options.slice();
      }
      if (phase === "playing") {
        const elapsed = Date.now() - questionStart;
        r.time_left_ms = elapsed >= QUESTION_TIME_MS ? 0 : QUESTION_TIME_MS - elapsed;
        r.answered = room.activePlayers().filter((p) => p.answered).length;
      } else if (phase === "reveal") {
        r.correct = q.correct;
      }
      return r;
    },
    tick: (room, now) => {
      if (phase === "playing" && now - questionStart > QUESTION_TIME_MS) {
        doReveal(room);
        return true;
      }
      return false;
    },
  };
}

module.exports = {
  id: "quiz",
  name: "Quiz",
  emoji: "🧠",
  desc: "Questions à choix multiples, score au chrono.",
  create,
};
