# Guide débutant — Flipper-Quiz (Windows 11)

Ce guide t'accompagne **de zéro** : installer les outils, flasher la carte Wi-Fi,
installer l'app Flipper, brancher le tout et lancer une partie de quiz
multijoueur **sans internet**. Aucune connaissance préalable requise.

---

## 0. Ce que tu vas obtenir

Un quiz type « Kahoot » qui marche **hors-ligne**, chez toi :

- La **Wi-Fi Dev Board (ESP32-S2)** crée son propre réseau Wi-Fi `Flipper-Quiz`.
- Les joueurs rejoignent ce réseau avec leur **téléphone** → la page du jeu
  s'ouvre toute seule (comme le Wi-Fi d'un hôtel).
- L'écran du **Flipper Zero** sert de tableau de bord au maître du jeu, qui fait
  défiler les questions avec les boutons physiques.

```
Telephones ──Wi-Fi──> ESP32-S2 (reseau "Flipper-Quiz")
   (page de jeu)          │
                          └──cable interne──> Flipper Zero (app Quiz Master)
```

---

## 1. Le matériel

- Un **Flipper Zero**.
- La **Wi-Fi Developer Board** officielle (ESP32-S2).
- Un câble **USB-C** (pour le PC).
- Un PC sous **Windows 11**.
- 1 ou plusieurs **smartphones** pour jouer.

---

## 2. Installer les logiciels (à faire une seule fois)

### 2.1 Python

1. Va sur https://www.python.org/downloads/ et installe **Python 3** (dernière version).
2. ⚠️ **Très important** : sur le premier écran de l'installateur, coche
   **« Add python.exe to PATH »** avant de cliquer sur *Install Now*.
3. Vérifie : ouvre **PowerShell** (menu Démarrer → tape `powershell`) et tape :
   ```powershell
   python --version
   pip --version
   ```
   Tu dois voir des numéros de version. Si « commande introuvable », réinstalle
   en cochant bien la case PATH.

### 2.2 PlatformIO (pour la carte Wi-Fi ESP32)

Dans PowerShell :
```powershell
pip install -U platformio
```
Vérifie :
```powershell
pio --version
```
> Si `pio` n'est pas reconnu, ferme et rouvre PowerShell (le PATH se met à jour
> au redémarrage du terminal).

### 2.3 ufbt (pour l'app Flipper)

```powershell
pip install -U ufbt
ufbt update
```
`ufbt update` télécharge le kit de développement correspondant à ton Flipper
(à faire au premier usage et après chaque grosse mise à jour du Flipper).

### 2.4 qFlipper (recommandé)

Installe **qFlipper** depuis https://flipperzero.one/update : il fournit les
**pilotes USB** du Flipper et permet de mettre à jour son firmware.
> ⚠️ qFlipper **occupe le port USB** du Flipper quand il est ouvert. **Ferme-le**
> avant d'utiliser `ufbt` (sinon « port occupé »).

### 2.5 Git (optionnel)

Pour récupérer le code en ligne de commande : https://git-scm.com/download/win
(sinon, tu peux télécharger le projet en ZIP depuis GitHub → bouton *Code* →
*Download ZIP*, puis décompresser).

---

## 3. Récupérer le code du projet

Dans PowerShell, place-toi où tu veux (ex. le Bureau) :
```powershell
cd $HOME\Desktop
git clone https://github.com/kponseel/PickMate.git
cd PickMate
```
(Ou décompresse le ZIP et fais `cd` dans le dossier obtenu.)

---

## 4. Flasher la carte Wi-Fi (ESP32-S2)

> Cette étape installe le **serveur du jeu** sur la Dev Board.

1. **Branche la Dev Board seule** au PC avec le câble USB-C (pas encore montée
   sur le Flipper).
2. Trouve son port COM :
   ```powershell
   pio device list
   ```
   Note le port (ex. `COM5`). Tu peux aussi regarder dans le **Gestionnaire de
   périphériques** → *Ports (COM et LPT)*.
3. Compile et téléverse le **firmware** :
   ```powershell
   cd esp32-quiz
   pio run -t upload
   ```
   La première fois, PlatformIO télécharge l'outillage ESP32 (quelques minutes).

4. Téléverse la **page web** (SPA `data/`) sur le LittleFS :
   ```powershell
   pio run -t uploadfs
   ```
   ⚠️ **Indispensable** : sans cette étape, la page joueur sera vide et l'admin
   panel inaccessible. À refaire chaque fois que tu modifies un fichier dans
   `esp32-quiz/data/` (HTML/CSS/JS).

5. **Si un flash échoue** (« Failed to connect », « No serial data received »),
   mets la carte en **mode bootloader** :
   - **Maintiens le bouton `BOOT`** de la Dev Board,
   - appuie brièvement sur `RESET` (sans lâcher BOOT),
   - **relâche `BOOT`**,
   - relance la commande (`pio run -t upload` ou `pio run -t uploadfs`).

6. **Vérifie que ça tourne** :
   ```powershell
   pio device monitor
   ```
   Tu dois voir une ligne du type `[wifi_portal] AP 'GamesHub' up at 192.168.4.1`
   suivie de `LittleFS mounted (used ... bytes)` et `1 game(s) registered`.
   (Quitte le moniteur avec `Ctrl+C`.)

✅ À ce stade, même sans le Flipper, tu peux déjà tester : connecte ton téléphone
au Wi-Fi **Flipper-Quiz** et ouvre la page de jeu. En bas de la page, le lien
**« Admin »** ouvre le pupitre du maître du jeu (`http://192.168.4.1/admin`),
**protégé par mot de passe** :

- **Identifiant** : `admin`
- **Mot de passe** : `adminadmin`

Depuis cette page : boutons *Démarrer / Question suivante* et *Reset*, avec
l'état en direct (joueurs, question). ⚠️ Sur un Wi-Fi ouvert le mot de passe
circule en clair : c'est un simple garde-fou, pas une vraie sécurité.

---

## 5. Installer l'app Quiz Master sur le Flipper

1. **Ferme qFlipper** s'il est ouvert.
2. Branche le **Flipper Zero** au PC en USB-C.
3. Depuis le dossier du projet :
   ```powershell
   cd ..\apps\quiz_master
   ufbt launch
   ```
   `ufbt launch` **compile**, **installe** l'app sur la carte SD du Flipper, puis
   la **lance** automatiquement à l'écran.

> Pour seulement compiler sans lancer : `ufbt`. Le fichier `.fap` se trouve alors
> dans `dist\`. Tu peux aussi le copier à la main dans `apps\GPIO\` sur la carte SD.

Plus tard, l'app reste accessible sur le Flipper dans **Apps → GPIO → Quiz Master**.

---

## 6. Monter la carte sur le Flipper

1. **Débranche** tout de l'USB.
2. **Enfiche la Wi-Fi Dev Board** sur le connecteur GPIO du Flipper (elle se
   clipse sur le dessus). C'est ce qui relie l'ESP32 et le Flipper en interne
   (liaison série UART).
3. Alimente le Flipper (sur batterie, ou la Dev Board via son propre USB).

> ⚠️ Le code suppose la liaison série standard du Flipper (broches **13/14**).
> Si rien ne s'affiche côté Flipper, voir le **Dépannage**.

---

## 7. Lancer une partie 🎉

1. Sur le Flipper : ouvre **Apps → GPIO → Quiz Master**. L'écran affiche
   `Joueurs: 0` et `Etat: lobby`.
2. **Joueurs** : sur chaque téléphone, ouvre les réglages Wi-Fi et rejoins le
   réseau **`Flipper-Quiz`** (réseau ouvert, sans mot de passe). La page du jeu
   s'ouvre automatiquement.
   - Si elle ne s'ouvre pas : ouvre le navigateur et va sur `http://192.168.4.1`.
3. Chaque joueur saisit un **pseudo** et appuie sur *Rejoindre*. Le compteur
   `Joueurs` augmente sur le Flipper.
4. Le maître du jeu utilise les **boutons du Flipper** :
   - **OK** = démarrer / question suivante / révéler la réponse,
   - **Bas** = recommencer la partie (reset),
   - **Retour** = quitter l'app.
5. Sur les téléphones : 4 gros boutons **A / B / C / D**. Plus on répond **vite
   et juste**, plus on marque de points. À la fin, le **classement** s'affiche.

> Pas de Flipper sous la main ? Pilote depuis le lien **Admin** de la page joueur
> (ou `http://192.168.4.1/admin`), identifiant `admin` / mot de passe `adminadmin`.

---

## 8. (Option) Laisser Claude Code flasher à ta place

Claude **Code** (le terminal) peut exécuter les commandes de flash pour toi.
Pour rester en sécurité, **n'active pas** « tous les accès » : autorise seulement
les commandes utiles via un fichier `.claude/settings.json` à la racine du projet :

```json
{
  "permissions": {
    "allow": [
      "Bash(pio run:*)",
      "Bash(pio device:*)",
      "Bash(ufbt:*)"
    ]
  }
}
```

Rappel : le passage en **mode bootloader** (boutons BOOT/RESET) reste **manuel** —
Claude ne peut pas appuyer physiquement sur les boutons.

---

## 9. Dépannage

| Problème | Solution |
|---|---|
| `pio` ou `ufbt` « introuvable » | Ferme/rouvre PowerShell. Vérifie que Python est « dans le PATH ». |
| Flash ESP32 « Failed to connect » | Mode bootloader : maintiens **BOOT**, tape **RESET**, relâche BOOT, relance. |
| `ufbt` : « port occupé / busy » | **Ferme qFlipper** (il garde le port du Flipper). |
| Pas de port COM | Autre câble USB (certains sont « charge seule »). Vérifie le Gestionnaire de périphériques. |
| La page ne s'ouvre pas sur le téléphone | Va manuellement sur `http://192.168.4.1`. Désactive les données mobiles. |
| Flipper affiche `Joueurs: 0` et `Etat: ...` figé | La liaison UART ne passe pas : vérifie que la carte est bien enfichée ; au besoin, adapte `FLIPPER_UART_RX_PIN/TX_PIN` dans `esp32-quiz/src/main.cpp`. |
| Erreur de build `ufbt` après MAJ Flipper | Relance `ufbt update`. |

---

## 10. Personnaliser les questions

Édite le tableau `QUESTIONS[]` dans `esp32-quiz/src/main.cpp` (chaque ligne :
texte, 4 réponses, index de la bonne réponse de 0 à 3), puis re-flashe avec
`pio run -t upload`.

```c
{"Ta question ?", {"Reponse A", "Reponse B", "Reponse C", "Reponse D"}, 1},
//                                                          bonne reponse = index 1 (B)
```

Bon jeu ! 🎮
