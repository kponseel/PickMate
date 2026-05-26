# Flipper Zero & ESP32 — projets

Dépôt de développement pour le **Flipper Zero** et sa **Wi-Fi Developer Board (ESP32-S2)**.

## Sous-projets

| Dossier        | Description |
|----------------|-------------|
| [`apps/`](apps/)             | Applications externes Flipper (`.fap`) en C, buildées avec [`ufbt`](https://github.com/flipperdevices/flipperzero-ufbt). Inclut `gameshub`, l'hôte générique de la plateforme. |
| [`esp32-hub/`](esp32-hub/) | **GamesHub** : plateforme de jeux de soirée multi-téléphone, locale et hors-ligne, pour l'ESP32-S2 (point d'accès Wi-Fi + portail captif + WebSocket). Voir son [README](esp32-hub/README.md). |

> 🚀 **Débutant ?** Suis le [**GUIDE.md**](GUIDE.md) : installation, flash et lancement d'une partie GamesHub pas-à-pas depuis Windows 11.
>
> 🤖 **Tu utilises Claude Code en local ?** Le fichier [**CLAUDE.md**](CLAUDE.md) contient les consignes que Claude lit automatiquement (matériel cible, commandes de flash, pièges).

## Démarrage rapide (Windows 11, PowerShell)

```powershell
pip install -U platformio ufbt   # outils (1re fois)
ufbt update                      # SDK Flipper (1re fois)

# 1) Serveur ESP32 (Wi-Fi Dev Board branchée par son USB)
cd esp32-hub
pio run -t upload                # flashe le firmware ; "Failed to connect" -> BOOT maintenu + RESET, relâche, relance
pio run -t uploadfs              # INDISPENSABLE : flashe data/ (page web) sur LittleFS

# 2) App Flipper (FERMER qFlipper d'abord — il verrouille le port)
cd ..\apps\gameshub
ufbt launch
```

Puis : monte la board sur le Flipper, ouvre **Apps → GPIO → Quiz Master**, connecte un
téléphone au Wi-Fi **`Paris - Mini Jeux Gratuits`**. Pilotage aussi possible via la page **Admin**
(lien en bas de la page joueur → `http://192.168.4.1/admin`, login `admin` / `adminadmin`).

---

## Apps Flipper Zero (`apps/`)

Applications externes (`.fap`) écrites en C avec l'outil [`ufbt`](https://github.com/flipperdevices/flipperzero-ufbt) (micro Flipper Build Tool).

## Prérequis

- Un **Flipper Zero** (idéalement avec un firmware à jour).
- **Python 3.8+** installé.
- Installer `ufbt` :

  ```bash
  python3 -m pip install --upgrade ufbt
  ```

- Au premier lancement, `ufbt` télécharge le SDK correspondant à ton firmware :

  ```bash
  ufbt update
  ```

## Structure du dépôt

```
.
├── apps/
│   ├── hello_world/          # App d'exemple minimale (GUI)
│   │   ├── application.fam   # Manifeste de l'app
│   │   └── hello_world.c     # Point d'entrée + logique
│   └── gameshub/          # Maître du jeu GamesHub (UART <-> ESP32)
│       ├── application.fam
│       └── gameshub.c
├── esp32-hub/               # Serveur de quiz ESP32-S2 (projet séparé)
├── CLAUDE.md                 # Consignes projet pour Claude Code (local)
├── GUIDE.md                  # Guide débutant pas-à-pas (Windows 11)
├── DEBUG_BRIEF.md            # Contexte + protocoles + code complet (debug)
└── README.md
```

Chaque application vit dans son propre dossier sous `apps/` et contient au minimum un manifeste `application.fam` et un fichier source C.

## Compiler & déployer une app

Depuis le dossier de l'app (par ex. `apps/hello_world`) :

```bash
cd apps/hello_world

# Compiler le .fap
ufbt

# Compiler puis l'installer sur le Flipper connecté en USB et la lancer
ufbt launch
```

Le `.fap` généré se trouve dans `dist/`. Tu peux aussi le copier manuellement dans `apps/<catégorie>/` sur la carte SD du Flipper.

Commandes utiles :

```bash
ufbt cli      # ouvre la CLI du Flipper
ufbt flash    # flashe le firmware (DFU)
ufbt vscode_setup   # génère la config VS Code (IntelliSense, build, debug)
```

## Ajouter une nouvelle app

1. Crée un dossier `apps/<nom_app>/`.
2. Ajoute un `application.fam` (voir l'exemple `hello_world`).
3. Implémente le point d'entrée déclaré dans `entry_point`.
4. `cd apps/<nom_app> && ufbt launch`.

## Références

- Documentation Flipper Zero : https://docs.flipper.net/
- Référence du firmware / API C : https://developer.flipper.net/
- `ufbt` : https://github.com/flipperdevices/flipperzero-ufbt
- Exemples officiels d'apps : https://github.com/flipperdevices/flipperzero-firmware/tree/dev/applications/examples

## Note

Les capacités sub-GHz, RFID/NFC, infrarouge et Wi-Fi (via la dev board ESP32) sont soumises à la réglementation locale. N'utilise ces fonctions que sur tes propres équipements/réseaux ou dans un cadre explicitement autorisé.
