// Server-side game registry. The ids here MUST match the client renderers'
// ids (window.Apero.register(id, ...)). To add a game: create its module here
// (copy quiz.js), add it to GAMES, and ship a matching client renderer in
// public/games/<id>.js included from index.html.

const quiz = require("./quiz");

const GAMES = [
  quiz,
  // ... port the other 15 from esp32-hub/src/games/ here.
];

module.exports = {
  list: () => GAMES.map((g) => ({ id: g.id, name: g.name, emoji: g.emoji, desc: g.desc })),
  get: (id) => GAMES.find((g) => g.id === id),
};
