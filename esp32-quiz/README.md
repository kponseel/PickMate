# Flipper-Quiz — serveur ESP32-S2

Quiz multijoueur **local et hors-ligne** pour la Wi-Fi Developer Board (ESP32-S2).
L'ESP32 crée son propre point d'accès, ouvre automatiquement l'interface de jeu
sur le téléphone des joueurs (portail captif), et gère la partie en temps réel
via WebSocket. Le maître du jeu fait défiler les questions depuis le Flipper Zero
(UART) ou depuis un navigateur.

> Réseau ouvert et volontaire, page de jeu uniquement : c'est l'équivalent d'un
> splash WiFi d'hôtel, pas un outil offensif.

## Architecture

```
Smartphones ──Wi-Fi──> ESP32-S2 (AP "Flipper-Quiz", 192.168.4.1)
   (UI web /ws)          │  captive portal + serveur web + WebSocket + jeu
                         │
                         └──UART──> Flipper Zero (.fap)  ← maître du jeu
```

- **AP Wi-Fi ouvert** : `Flipper-Quiz`
- **Portail captif** : DNS « catch-all » + redirection HTTP → la page s'ouvre seule
- **UI joueur** : `index.html` embarqué (HTML/CSS/JS en un seul fichier, vanilla JS)
- **Temps réel** : WebSocket `/ws` (JSON)
- **Maître du jeu** : Flipper via UART, ou `/admin/*` depuis un navigateur

## Build & flash

Avec [PlatformIO](https://platformio.org/) :

```bash
cd esp32-quiz
pio run                 # compile
pio run -t upload       # flashe l'ESP32 connecté en USB
pio device monitor      # logs série (115200)
```

Si ta carte n'est pas une ESP32-S2 Saola générique, ajuste `board` dans
`platformio.ini`.

> IDE Arduino : renomme `src/main.cpp` en `.ino`, installe les libs
> `ArduinoJson`, `ESPAsyncWebServer` et `AsyncTCP`, sélectionne ta carte ESP32-S2.

## Jouer

1. Flashe l'ESP32 et alimente-le.
2. Sur les téléphones : rejoindre le Wi-Fi **Flipper-Quiz** → la page de jeu
   s'ouvre seule (sinon, aller sur `http://192.168.4.1`).
3. Chaque joueur saisit un pseudo.
4. Le maître lance et fait avancer la partie :
   - via le Flipper (bouton OK) — voir l'app `.fap` (à venir), ou
   - via un navigateur : `http://192.168.4.1/admin/next` (démarrer / question
     suivante / révéler) et `/admin/reset` (recommencer).

Score façon Kahoot : bonne réponse = 500 pts + jusqu'à 500 pts de bonus de
rapidité. Une question se révèle quand tous ont répondu ou après 20 s.

## Protocole UART (ESP32 ↔ Flipper)

Lignes ASCII terminées par `\n`.

**ESP32 → Flipper :**

| Message        | Sens                                   |
|----------------|----------------------------------------|
| `PLAYERS:<n>`  | nombre de joueurs connectés            |
| `STATE:<s>`    | `lobby` / `question` / `reveal` / `finished` |
| `Q:<i>/<n>`    | question courante / total              |

**Flipper → ESP32 :**

| Commande | Effet                          |
|----------|--------------------------------|
| `START`  | démarre la partie              |
| `NEXT`   | question suivante / révèle      |
| `RESET`  | réinitialise                    |

⚠️ **Câblage UART** : adapte `FLIPPER_UART_RX_PIN` / `FLIPPER_UART_TX_PIN` en
haut de `src/main.cpp` au branchement réel entre l'ESP32 et le header GPIO du
Flipper (TX d'un côté → RX de l'autre).

## Personnaliser les questions

Édite le tableau `QUESTIONS[]` dans `src/main.cpp` (texte, 4 options, index de
la bonne réponse 0–3).
