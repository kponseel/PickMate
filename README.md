# Flipper Zero & ESP32 — projets

Dépôt de développement pour le **Flipper Zero** et sa **Wi-Fi Developer Board (ESP32-S2)**.

## Sous-projets

| Dossier        | Description |
|----------------|-------------|
| [`apps/`](apps/)             | Applications externes Flipper (`.fap`) en C, buildées avec [`ufbt`](https://github.com/flipperdevices/flipperzero-ufbt). Inclut `quiz_master`, le maître du jeu Flipper-Quiz. |
| [`esp32-quiz/`](esp32-quiz/) | **Flipper-Quiz** : serveur de quiz multijoueur local et hors-ligne pour l'ESP32-S2 (point d'accès Wi-Fi + portail captif + WebSocket). Voir son [README](esp32-quiz/README.md). |

> 🚀 **Débutant ?** Suis le [**GUIDE.md**](GUIDE.md) : installation, flash et lancement d'une partie Flipper-Quiz pas-à-pas depuis Windows 11.

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
│   └── quiz_master/          # Maître du jeu Flipper-Quiz (UART <-> ESP32)
│       ├── application.fam
│       └── quiz_master.c
├── esp32-quiz/               # Serveur de quiz ESP32-S2 (projet séparé)
├── GUIDE.md                  # Guide débutant pas-à-pas (Windows 11)
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
