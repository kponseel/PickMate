# 🍹 Aperolympics

Les **jeux olympiques de l'apéro** : plateforme de jeux de soirée multijoueur,
**en ligne**, jouable depuis le navigateur de chaque téléphone, installable en
**PWA** (Android + iPhone). Version hébergée de [GamesHub](https://github.com/kponseel/PickMate)
(sans Flipper Zero ni ESP32).

- **Serveur** Node.js + **Socket.IO** (état faisant autorité, en mémoire).
- **Rooms** : chaque groupe joue dans une partie isolée (code à 4 lettres / lien `…/r/CODE`).
- **Front** : SPA vanilla JS réutilisée de GamesHub + PWA (manifest + service worker).

## Démarrer en local

```bash
cd aperolympics
npm install
npm start            # http://localhost:3000
```

Ouvre `http://localhost:3000`, **crée une partie**, puis rejoins-la depuis un 2ᵉ
onglet (ou ton téléphone sur le même réseau) avec le **code** affiché. L'hôte 👑
choisit une épreuve et fait *Démarrer* / *Question suivante*.

## Arborescence

```
aperolympics/
├── package.json
├── server/
│   ├── index.js          # HTTP (sert public/) + Socket.IO + orchestration
│   ├── rooms.js          # registre + modèle de room (reconnexion par pseudo)
│   └── games/
│       ├── registry.js   # liste des jeux (ids = ceux des renderers client)
│       └── quiz.js        # logique Quiz (portée de esp32-hub/src/games/quiz.cpp)
└── public/               # PWA servie telle quelle
    ├── index.html
    ├── app.js            # cœur SPA (Socket.IO, rooms, routage, helpers)
    ├── style.css
    ├── games/quiz.js     # renderer Quiz (contrat identique à GamesHub)
    ├── manifest.webmanifest
    ├── sw.js             # service worker (cache du shell)
    └── icons/icon.svg
```

## Protocole (conservé depuis GamesHub)

- **client → serveur** (`socket.emit("msg", …)`) : `{t:"create",name}` · `{t:"join",name,room}` ·
  `{t:"select_game",id}` · `{t:"next"|"start"}` · `{t:"reset"}` · messages du jeu.
- **serveur → client** : `socket.on("state", …)` `{phase,game,hostId,room,players[],round{}}`
  et `socket.on("private", …)` (chuchotements par joueur : rôle/mot/question).
- Phases : `lobby` · `playing` · `reveal` · `finished`.

## Porter une épreuve (les 15 autres)

Pour chaque jeu de `esp32-hub/src/games/<jeu>.cpp` :
1. **Serveur** : crée `server/games/<jeu>.js` en copiant la forme de `quiz.js`
   (un `create()` qui renvoie les hooks `phase/onSelect/onAdvance/onMessage/
   serializeRound/tick/…`), et traduis la logique du `.cpp`.
2. Ajoute-le à `server/games/registry.js`.
3. **Client** : copie `public/games/<jeu>.js` depuis `esp32-hub/data/js/games/<jeu>.js`
   (helpers identiques ; un alias `window.GamesHub = window.Apero` est en place,
   donc le `register(...)` marche tel quel).
4. Ajoute `<script src="/games/<jeu>.js"></script>` dans `index.html`.

L'id doit être **identique** côté serveur et client.

## Déployer sur Hostinger (Business — App Node.js depuis GitHub)

1. Pousse ce dossier dans un dépôt GitHub (ex. `aperolympics`).
2. hPanel → **Node.js** → *Create application* → connecte le dépôt/branche.
   - **Application root** : la racine du dépôt (ou `aperolympics/` si tu gardes ce
     sous-dossier dans un mono-repo).
   - **Build command** : `npm install`
   - **Start command** : `npm start`
   - **Node version** : 18+.
3. Hostinger fournit le **HTTPS** sur ton domaine. C'est tout.

> ⚠️ **WebSockets entrantes bloquées** sur l'hébergement mutualisé Hostinger : pas
> de souci, Socket.IO **bascule automatiquement en long-polling HTTP**. La partie
> fonctionne, avec une latence un peu plus élevée (OK pour un jeu de soirée). Pour
> du WebSocket « pur », il faudra un **VPS** (ou Railway/Render/Fly).

Le serveur écoute sur `process.env.PORT` (fallback 3000) — Hostinger l'injecte.

## PWA / icônes

`manifest.webmanifest` + `sw.js` rendent l'app installable (« Ajouter à l'écran
d'accueil »). L'icône fournie est un **SVG** ; pour une compat maximale (surtout
iOS), ajoute des PNG `192×192` et `512×512` dans `public/icons/` et référence-les
dans le manifest et l'`apple-touch-icon`.

## Limites connues (starter)

- **Une seule épreuve portée** (Quiz). Les 15 autres sont à porter (voir plus haut).
- État **en mémoire** : un redémarrage du process vide les parties en cours.
- Pas d'auth admin ici (le contrôle passe par le rôle *host*, élu = 1ᵉʳ connecté).
