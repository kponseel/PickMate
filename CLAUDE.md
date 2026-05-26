# CLAUDE.md — consignes projet

Contexte pour Claude Code lancé **en local sur le PC de l'utilisateur** (Windows 11,
PowerShell). Le but immédiat : **flasher et lancer le quiz Flipper-Quiz**.

## C'est quoi ce dépôt
Deux sous-projets reliés par une liaison série :
- `esp32-quiz/` — serveur de quiz **ESP32-S2** (PlatformIO / Arduino). Code : `esp32-quiz/src/main.cpp`.
- `apps/quiz_master/` — app **Flipper Zero** (`.fap`, C) qui pilote le jeu en UART.
- `apps/hello_world/` — exemple Flipper minimal.

Détails : `README.md`, `GUIDE.md` (pas-à-pas), `DEBUG_BRIEF.md` (protocoles + code complet).

## Matériel cible de l'utilisateur
- **Windows 11**, PowerShell.
- **Flipper Zero** « Ascanas », firmware **OFW 1.4.3**, vu sur **COM3** (via qFlipper).
- **Wi-Fi Developer Board officielle (ESP32-S2)**, branchée en USB (mode boot pour flasher).

## Pré-requis (installer si absent)
```powershell
pip install -U platformio ufbt
ufbt update    # 1re fois : télécharge le SDK Flipper correspondant
```

## Étape A — flasher le serveur ESP32
```powershell
cd esp32-quiz
pio device list        # repérer le port COM de la board
pio run -t upload      # compile + flashe. La sortie DOIT dire "Chip is ESP32-S2"
pio device monitor     # doit afficher "Flipper-Quiz AP ... up at 192.168.4.1" (Ctrl+C pour quitter)
```
- Si **"Failed to connect"** : maintenir **BOOT**, taper **RESET**, relâcher BOOT, relancer.
- À ce stade, testable sans le Flipper : téléphone → Wi-Fi `Flipper-Quiz` → page de jeu.

## Étape B — installer l'app Flipper
```powershell
# IMPORTANT : fermer qFlipper d'abord (il verrouille COM3, sinon ufbt échoue)
cd apps\quiz_master
ufbt launch            # compile + installe sur la SD + lance l'app sur le Flipper
```

## Vérifier que tout marche
- Téléphone → Wi-Fi **`Flipper-Quiz`** → la page s'ouvre seule (sinon `http://192.168.4.1`).
- Lien **« Admin »** en bas de la page → `http://192.168.4.1/admin` → login **`admin` / `adminadmin`**.
- Le compteur **`Joueurs:`** (écran Flipper + page admin) **doit monter** quand un téléphone rejoint → c'est le signe que **l'UART passe**.
- Bouton **OK** du Flipper (ou bouton de la page admin) = question suivante ; **Bas** = reset.

## Pièges à NE PAS oublier
- **Fermer qFlipper** avant tout `ufbt`.
- **UART** : ESP32-S2 **GPIO44 = RX** (← Flipper pin 13 TX), **GPIO43 = TX** (→ Flipper pin 14 RX). Croisement TX↔RX.
- Si le build PlatformIO échoue sur un **tag de lib manquant**, enlever le suffixe `#vX.Y.Z` dans `esp32-quiz/platformio.ini`.
- `board = esp32-s2-saola-1` (S2 générique) ; ajuster seulement si l'upload est capricieux.
- ESP32 et Flipper sont **deux périphériques USB distincts** : ne pas confondre leurs ports COM.
- Le Wi-Fi ESP32 plafonne en pratique à **~8 téléphones** ; mot de passe admin **en clair** sur réseau ouvert (garde-fou, pas une sécurité).

## Workflow git
- Brancher le travail sur `claude/flipper-zero-wifi-exploit-Br4ii` ; merger dans `main` quand demandé.
- `.claude/settings.json` autorise déjà `pio` / `ufbt` / `git pull` / `git clone`.
- Ne pas committer de secrets.
