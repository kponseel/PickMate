# 🎲 Les jeux de GamesHub

GamesHub est une **plateforme de jeux de soirée multi-téléphone, locale et hors-ligne** :
les joueurs rejoignent le Wi-Fi de l'ESP32, ouvrent la page web, et jouent depuis
leur téléphone. **16 jeux** sont inclus.

## Comment ça marche (général)
- Un **hôte** 👑 (élu automatiquement parmi les joueurs) choisit un jeu depuis le hub.
- Tout le monde joue sur son **téléphone** ; l'état est synchronisé en temps réel.
- L'hôte fait **avancer** la partie via *Suivant* (sur son tel), le **bouton OK du Flipper**, ou la page **Admin** (`/admin`). *Bas* (Flipper) ou *Reset* recommence.
- Les règles de chaque jeu sont aussi affichées **dans l'app** (carte « 📖 Comment jouer » du lobby).

## Vue d'ensemble

| Jeu | Cat. | En bref | Joueurs |
|-----|------|---------|---------|
| 🧠 **Quiz** | Culture | QCM A/B/C/D, score au chrono | 1+ |
| 🤥 **Le Bluff** | Culture | Écris une fausse réponse, vote la vraie | 2+ |
| 😈 **Le plus susceptible** | Vote | Vote secret « qui est le plus susceptible de… ? » | 2+ |
| 🏆 **Superlatifs** | Vote | Qui est le/la plus *X* du groupe ? (podium) | 2+ |
| ⚖️ **Tu préfères** | Vote | Dilemmes A ou B, vote en direct | 2+ |
| 🙊 **Je n'ai jamais** | Vote | « J'ai déjà » / « Jamais », compteurs anonymes | 2+ |
| 👀 **Paranoia** | Vote | Question secrète, on pointe quelqu'un, la pièce décide | 3+ |
| 🕶️ **Spyfall** | Rôle caché | Tous connaissent le lieu, sauf l'espion | 3+ |
| 🕵️ **Undercover** | Rôle caché | Un mot secret différent pour l'intrus | 3+ |
| 🐺 **Loups** | Rôle caché | Loup-Garou simplifié (nuit/jour) | 4+ |
| 🎤 **Vannes** | Création | 2 joueurs écrivent une punchline, la salle vote | 3+ |
| 🍻 **Picolo** | Soirée | Prompts qui montent, prénoms du groupe injectés | 2+ |
| 👑 **Roi des Bières** | Soirée | Deck de 52 cartes, chaque carte = une règle | 2+ |
| 🎭 **Action ou Vérité** | Soirée | Tour rotatif : vérité ou gage | 2+ |
| 🎲 **Gages** | Soirée | Roulette : un joueur + un gage au hasard | 2+ |
| 💣 **La Bombe** | Soirée | Patate chaude à timer caché, refile-la ! | 2+ |

---

## 🧠 Culture & bluff

### 🧠 Quiz  — `quiz`
*Questions à choix multiples, score au chrono.*
Une question + 4 options **A/B/C/D**. Tape la bonne réponse **le plus vite possible**.
**Score** = 500 pts + bonus chrono (plus tu réponds tôt, plus tu marques). L'hôte 👑
(ou le bouton OK du Flipper) avance entre chaque question.

### 🤥 Le Bluff — `bluff`
*Question difficile : écris une fausse réponse, vote la vraie.*
Une question **difficile** s'affiche (ex. « Quelle est la capitale du Kazakhstan ? »).
1. Chacun tape une **fausse réponse plausible** (max 31 caractères).
2. Toutes les fausses **+ la vraie** sont mélangées et affichées.
3. Vote la **VRAIE** réponse.
**Score :** +500 si tu trouves la vraie, +250 par joueur que ta fausse réponse a piégé.

---

## 🗳️ Votes & révélations

### 😈 Le plus susceptible — `most_likely`
*Vote secret : qui est le plus susceptible de… ?*
Qui dans le groupe colle le mieux à la phrase « Qui est le plus susceptible de… » ?
Tout le monde vote **en même temps**, sans voir les autres choix. Le reveal montre
le **classement complet** des votes par personne.

### 🏆 Superlatifs — `superlatives`
*Vote secret : qui est le/la plus X du groupe ?*
Variante du « plus susceptible » mais avec des **catégories** : drôle, style, organisé,
voyageur… Vote secret pour le/la **plus X du groupe**. Reveal sous forme de
**podium** 🥇🥈🥉 avec les compteurs.

### ⚖️ Tu préfères — `would_rather`
*Dilemmes à deux options, vote en direct.*
Un dilemme entre **A** ou **B** (« Pizza pour la vie » vs « Plus jamais de fromage »…).
Vote pour ton option préférée, en même temps que tout le monde. Le reveal affiche les
**compteurs par côté** dans des cartes colorées.

### 🙊 Je n'ai jamais — `never`
*Anonyme : j'ai déjà ou jamais ? On voit le score.*
Une phrase « Je n'ai jamais… » s'affiche. Chacun choisit **J'ai déjà** ou **Jamais**.
Le reveal montre uniquement les **compteurs** (totalement anonyme, sans nom). Le but :
ambiance, découvertes… et tu bois quand t'as déjà fait 😉.

### 👀 Paranoia — `paranoia`
*Question secrète à une personne. Le doigt parle… la pièce décide.*
1. Un seul joueur reçoit une **question privée** sur son tel (les autres ne voient rien).
2. Il/elle pointe discrètement la personne qui colle le mieux à la question.
3. Tout le groupe voit **qui** a été pointé — sans savoir pourquoi.
4. La **pièce 🪙** est tirée : 50 % de chance que la question soit révélée, 50 % qu'elle reste mystère.
Tour rotatif. Reste paranoïaque ! 👀

---

## 🕵️ Rôles cachés *(à l'oral + vote ; 3-4 joueurs min)*

### 🕶️ Spyfall — `spyfall` *(3+ joueurs)*
*Tous connaissent le lieu, sauf l'espion.*
Tous les tels affichent le **même lieu secret** (aéroport, plage, casino…), **sauf 1** :
l'espion 🕶️.
1. À l'oral, posez-vous des questions sur le lieu (« Y a-t-il du bruit ? », « On peut s'y asseoir ? »).
2. Civils : répondre sans trop révéler. Espion : bluffer pour rester discret.
3. Vote final : qui est l'espion ? Majorité juste = **les civils gagnent**, sinon **l'espion l'emporte**.

### 🕵️ Undercover — `undercover` *(3+ joueurs)*
*Mot secret différent pour l'intrus. Trouvez-le !*
Chacun reçoit un **mot privé** sur son tel. La **majorité** partage le même mot, mais
**1-2 undercover** (selon la taille du groupe) ont un mot **proche mais différent**.
1. À l'oral, chacun décrit son mot en **quelques mots** (sans le dire directement).
2. Après discussion, vote pour qui tu penses être l'intrus.
**Les civils gagnent** si l'undercover est démasqué, sinon **l'undercover gagne**.

### 🐺 Loups — `wolves` *(4+ joueurs)*
*Loup-Garou simplifié.* 1 loup si moins de 7 joueurs, **2 loups** si 7+.
- **🌙 Nuit :** les loups voient qui sont leurs alliés et choisissent une victime (vote privé).
- **☀️ Jour :** tout le village discute (à l'oral) puis vote qui éliminer.
- **Fin :** les villageois gagnent en éliminant **tous les loups** ; les loups gagnent quand ils sont **aussi nombreux** que les villageois.

---

## 🎤 Création

### 🎤 Vannes — `quips`
*Deux contestants écrivent la meilleure vanne, la salle vote.* (style Jackbox)
1. Un prompt s'affiche (« La pire excuse pour annuler un RDV »…).
2. **2 contestants** sont tirés au hasard. Ils tapent leur **punchline** (47 caractères max).
3. Les autres votent **A ou B**, anonymement.
4. Le gagnant marque des points. Ça tourne à chaque round.

---

## 🍻 Soirée & gages

### 🍻 Picolo — `picolo`
*Prompts escaladés avec les prénoms du groupe.*
L'hôte **avance dans une liste de prompts** qui montent en intensité. Les **prénoms du
groupe** sont injectés automatiquement (« {p1} mime un métier… » devient « Kevin mime un
métier… »). Suis simplement les instructions à l'oral. Ambiance soirée garantie 🍻.

### 👑 Roi des Bières — `kings`
*Tire une carte, applique la règle, passe au suivant.*
Un **deck de 52 cartes** partagé par le groupe ; chacun pioche à son tour. Chaque carte
déclenche une **règle** : As = Cascade, 2 = tu choisis qui boit, 3 = bois toi, 5 = Pouce,
Valet = Règle, Reine = Question, Roi = Coupe royale… Quand le **4ᵉ Roi** est tiré, celui qui
l'a pioché boit la **Coupe Royale 🍻**. Fin de partie !

### 🎭 Action ou Vérité — `truth_dare`
*Tour par tour : vérité ou gage, prompts piochés au hasard.*
1. Un joueur est mis en avant (les autres voient « C'est au tour de X »).
2. Il/elle choisit **🤐 Vérité** (question) ou **😤 Action** (gage).
3. Le prompt est tiré au hasard et s'affiche pour tout le monde.
4. Quand c'est fait, le joueur clique **Fait !** et on passe au suivant.

### 🎲 Gages — `dares`
*Gage aléatoire pour un joueur aléatoire.*
Une **roulette de gages** simple : un joueur + un gage sont tirés au hasard et affichés à
tout le groupe. Le joueur fait le gage **en personne**, puis clique **Fait !** pour piocher
le suivant. Tourne en boucle jusqu'au Reset.

### 💣 La Bombe — `bomb`
*Patate chaude avec timer caché. Refile-la !*
Une **bombe virtuelle** circule entre les tels, avec un **timer caché** de 20 à 60 secondes —
personne ne sait quand ça explose. Si tu as la bombe : tape sur le nom d'un autre joueur
pour **la lui passer**. **BOOM** quand le timer atteint 0 : celui qui la tient **perd la
manche** (compteur 💥). L'hôte relance un nouveau round.

---

> 💡 Le contenu (questions, prompts, lieux, mots…) vit dans les modules
> `esp32-hub/src/games/*.cpp`. Pour ajouter/modifier des prompts, édite le module
> concerné puis re-flashe (`pio run -t upload`). L'architecture des jeux est décrite
> dans `DEBUG_BRIEF.md` (interface `Game`).
