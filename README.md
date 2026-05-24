# Flipper Zero Apps

Dépôt de développement d'applications externes (`.fap`) pour le **Flipper Zero**, écrites en C avec l'outil [`ufbt`](https://github.com/flipperdevices/flipperzero-ufbt) (micro Flipper Build Tool).

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
│   └── hello_world/          # App d'exemple minimale (GUI)
│       ├── application.fam   # Manifeste de l'app
│       └── hello_world.c     # Point d'entrée + logique
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
