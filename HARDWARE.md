# Brief technique — Flipper Zero ↔ Wi-Fi Devboard (ESP32-S2)

> Doc destinée à un dev qui veut **réutiliser ce socle pour faire d'autres jeux/apps**
> sans repasser par les chausse-trappes qu'on s'est mangés.
> Spécifique au matériel **officiel Flipper Devices**.

## 1. Le matériel

| Composant | Détail |
|---|---|
| Flipper Zero | Cible firmware **OFW ≥ 1.4.x** (testé 1.4.3). API SDK : `Target: 7, API: 87.1`. |
| Wi-Fi Developer Board | **Modèle WD officiel** (flipper.net). Module **ESP32-S2-WROVER**. USB-C natif + bouton BOOT + bouton RESET. Se clipse sur le header GPIO du Flipper. |
| Liaison entre les deux | **UART hardware**, en interne via le header GPIO. Pas de câble. |

Le board s'alimente :
- via le **header GPIO** (3V3 fourni par le Flipper) quand il est clipsé → mode normal de jeu,
- via son **USB-C** quand on le flashe (devboard détaché du Flipper).

> ⚠️ Évite d'alimenter par les deux sources en même temps en exploitation. C'est
> sans danger immédiat mais source de bizarreries (re-énumération USB, reset…).

## 2. Le câblage UART (LA chose à ne pas se tromper)

Sur le board officiel WD, c'est routé en dur. Pour le code :

| Côté ESP32-S2 | Sens | Côté Flipper |
|---|---|---|
| **GPIO 43** (U0TXD) | **→** | **Pin 14** (USART RX) |
| **GPIO 44** (U0RXD) | **←** | **Pin 13** (USART TX) |

C'est **l'UART0 natif** de l'ESP32-S2 (pins fixes par le silicium). On le rappelle parce que **les anciens docs / repos communautaires** mentionnent souvent par erreur **GPIO 1/3** (UART0 sur l'ESP32 classique) ou **GPIO 17/18** (qui ne sont câblés à rien sur ce board). **Si la liaison ne fonctionne pas et que les contacts sont propres, vérifie ces pins en priorité.**

Côté Flipper, pin 13/14 = la périphérique **USART** (ID Furi : `FuriHalSerialIdUsart`). L'autre UART du STM32 (`FuriHalSerialIdLpuart`) sort sur les pins 15/16 et n'est **pas** câblée au devboard.

GND, 5V/3V3 : tu n'as rien à câbler manuellement, le header fait tout.

## 3. Code côté ESP32 (Arduino / PlatformIO)

```cpp
#define FLIPPER_UART_RX_PIN 44   // <- ESP recoit, depuis Flipper pin 13 (TX)
#define FLIPPER_UART_TX_PIN 43   // -> ESP emet,   vers   Flipper pin 14 (RX)
#define FLIPPER_UART_BAUD   115200

HardwareSerial FlipperSerial(1); // UART hardware 1 (UART0 reserve a la console)

void setup() {
    FlipperSerial.begin(FLIPPER_UART_BAUD, SERIAL_8N1,
                        FLIPPER_UART_RX_PIN, FLIPPER_UART_TX_PIN);
}
```

`platformio.ini` indispensable :
```ini
[env:flipper-wifi-devboard]
platform = espressif32
board    = esp32-s2-saola-1     ; cible S2 generique, suffit pour le WD
framework = arduino
monitor_speed = 115200
build_flags =
    ; Garde le `Serial` de debug sur l'USB-CDC natif S2,
    ; UART1 reste libre pour la liaison Flipper.
    -D ARDUINO_USB_CDC_ON_BOOT=1
```

Pour flasher la première fois ou si "Failed to connect" :
1. Connecter le devboard en USB **seul**.
2. Mettre en mode bootloader : **maintenir BOOT**, **appuyer RESET**, **relâcher BOOT**.
3. `pio run -t upload`.

## 4. Code côté Flipper (ufbt + C)

```c
#include <furi_hal_serial.h>
#include <furi_hal_serial_control.h>

#define UART_BAUD 115200

FuriHalSerialHandle* serial = furi_hal_serial_control_acquire(FuriHalSerialIdUsart);
if (!serial) {
    // Une autre app/process tient le port. Affiche un message au lieu de crash.
    // Cas typique : qFlipper / le shell CLI / un autre .fap encore charge.
    return;
}
furi_hal_serial_init(serial, UART_BAUD);
furi_hal_serial_async_rx_start(serial, rx_callback, ctx, false);

// ... a la fin :
furi_hal_serial_async_rx_stop(serial);
furi_hal_serial_deinit(serial);
furi_hal_serial_control_release(serial);
```

Le callback RX tourne en **interrupt context** : il faut juste pousser l'octet dans
un `FuriStreamBuffer` et faire le parsing dans un thread dédié (voir
`apps/quiz_master/quiz_master.c` pour l'exemple complet).

`application.fam` minimal :
```python
App(
    appid="ton_app",
    name="Ton App",
    apptype=FlipperAppType.EXTERNAL,
    entry_point="ton_app_main",
    stack_size=4 * 1024,
    fap_category="GPIO",
)
```

Build + install + run en une commande :
```powershell
cd apps\ton_app
ufbt launch
```

## 5. Protocole de message (à adapter à ton jeu)

On utilise un **protocole texte ligne-par-ligne** (`\n` final), simple à débugger
au moniteur série. Exemple actuel :

| Sens | Message | Sens fonctionnel |
|---|---|---|
| ESP → Flipper | `PLAYERS:3\n` | nombre de joueurs connectés |
| ESP → Flipper | `STATE:lobby\n` | état du jeu (`lobby`/`question`/`reveal`/`finished`) |
| ESP → Flipper | `Q:2/5\n` | progression de la question courante |
| Flipper → ESP | `NEXT\n` | bouton OK pressé |
| Flipper → ESP | `RESET\n` | bouton Down pressé |

C'est **idempotent** côté ESP : la fonction `sendToFlipper()` envoie l'**état
complet** à chaque évènement notable (join, change d'état, timeout). Si le
Flipper s'allume après l'ESP, il rattrape l'état à la première transition.
Pour les jeux futurs : garde ce pattern, ça évite plein de race conditions.

## 6. Les pièges qu'on s'est mangés (à éviter)

1. **Mauvais GPIO ESP32** — Le code initial du repo avait GPIO 17/18. Symptôme :
   tout marche (Wi-Fi, page web, joueurs), sauf le Flipper qui reste figé sur
   `Etat: ...`. C'est exactement ça qu'on a corrigé en passant à **43/44**.

2. **qFlipper qui verrouille le port COM** — ufbt échoue avec
   `could not open port 'COM3': Access is denied`. **Ferme qFlipper avant tout
   `ufbt`**, ou l'app mobile Flipper si elle est connectée en Bluetooth.

3. **ESP32-S2 ne passe pas en bootloader tout seul** — Sur USB natif, le reset
   automatique d'esptool ne fonctionne pas toujours. **Toujours faire
   BOOT+RESET manuellement** si "Failed to connect".

4. **Le devboard ne s'allume pas si la batterie du Flipper est trop basse** —
   Au début c'était notre cas et on a confondu ça avec un défaut UART. Si le
   Wi-Fi `Flipper-Quiz` ne broadcast pas, **charge le Flipper d'abord 30 min**
   ou alimente le devboard par son propre USB-C en exploitation.

5. **Le port COM de l'ESP32 disparaît après chaque flash** — Normal sur S2 USB
   natif : le reset déconnecte/reconnecte l'USB. Attendre 2-3 sec qu'il
   ré-énumère avant de relancer le monitor série.

6. **`desktop.ini` casse git sur Windows** — Windows en sème partout, y compris
   dans `.git/refs/` où ils corrompent les références. C'est dans le `.gitignore`
   du repo mais si tu vois `fatal: bad object refs/desktop.ini`, fais :
   ```bash
   find .git -name "desktop.ini" -delete
   ```

7. **Captive portal vs warning "pas d'internet"** — C'est un choix UX, pas un
   bug. Voir `CAPTIVE_PORTAL_ENABLED` dans `esp32-quiz/src/main.cpp` :
   - `true` (défaut) → la page s'ouvre auto sur les téléphones, mais Android
     affiche "pas d'accès Internet" et risque de déconnecter.
   - `false` (stealth) → on répond aux probes de connectivité (Android
     `/generate_204`, Windows `ncsi.txt`, iOS `hotspot-detect.html`) comme si
     internet marchait, pas de warning, pas de déconnexion, mais les joueurs
     doivent taper `http://192.168.4.1/` eux-mêmes.

## 7. Bootstrapping un nouveau jeu

1. **Fork le repo** (ou copie `esp32-quiz/` et `apps/quiz_master/` dans un nouveau).
2. **Côté ESP32** : remplace la logique `QUESTIONS[]`, `gameState`, `advance()`,
   etc. par celle de ton jeu. Garde `setup()`, `loop()`, le bloc `setupServer()`
   et `sendToFlipper()` comme socle.
3. **Côté Flipper** : remplace le rendu `draw_cb()` et la gestion des inputs.
   Garde la pompe UART (`uart_rx_cb`, `uart_worker`, `parse_line`) intacte ;
   change juste les préfixes que tu parses et ce que tu envoies sur les
   boutons.
4. **Définit ton protocole** sur quelques lignes en début de fichier, puis
   reste fidèle. Réutilise `KEY:VALUE\n` text-based ; binaire est tentant
   mais te coûtera 10× plus en debug.

## 8. Tests de diagnostic rapides

- **L'ESP32 boote ?** → SSID `Flipper-Quiz` (ou ton nom custom) visible dans la
  liste Wi-Fi d'un téléphone, sous 5 secondes.
- **Le web server répond ?** → `http://192.168.4.1/` charge la page, ou
  `/admin/reset` renvoie `ok`.
- **L'app Flipper a bien acquis l'USART ?** → si l'écran affiche `Etat:
  USART occupe!`, une autre app/process tient le port.
- **L'UART transmet réellement ?** → quand un téléphone rejoint via WebSocket,
  l'ESP appelle `sendToFlipper()` qui envoie `PLAYERS:1\n` puis `STATE:lobby\n`.
  L'écran Flipper **doit** mettre à jour `Joueurs:` et `Etat:` dans la seconde.
  Si oui → tout marche. Si non → câblage / mauvais pins / mauvais
  `FuriHalSerialId` côté Flipper.
- **Fallback ultime** : utilise l'app intégrée **GPIO → USB-UART Bridge** du
  Flipper (UART pins 13/14, baud 115200) avec un terminal série sur le PC. Si
  tu vois les bytes de l'ESP dans le terminal, le hardware marche, le bug est
  dans le code de l'app custom.

## 9. Limites pratiques connues

- **Stations Wi-Fi max** : `softAP(..., AP_MAX_CONN)` est configuré à un
  plafond (cf. `AP_MAX_CONN` dans le `.cpp`). L'ESP32-S2 plafonne en pratique
  à **~8 clients** stables. Au-delà, attends-toi à des reconnexions.
- **Latence UART** : 115200 baud, line-based, ~1 ms pour pousser une ligne
  courte. C'est largement assez pour un jeu type quiz/Kahoot/buzz.
- **Sécurité** : le réseau est ouvert par défaut. Le panneau `/admin` est
  protégé par un login en clair (`admin`/`adminadmin` dans le code) sur un
  réseau ouvert → c'est un garde-fou pour pas que les joueurs trafiquent le
  jeu, **pas** une sécurité crypto. Ne réutilise pas ce pattern pour héberger
  quoi que ce soit de sensible.

---

**TL;DR pour le prochain dev :**

1. ESP32 ↔ Flipper = **UART à 115200**, GPIO **43/44** côté ESP, pins **13/14**
   côté Flipper (USART, `FuriHalSerialIdUsart`).
2. `build_flags = -D ARDUINO_USB_CDC_ON_BOOT=1` côté PlatformIO sinon UART0
   passe en USB-CDC et tu n'as plus de Serial debug.
3. Mode bootloader manuel sur le devboard si esptool n'arrive pas à se
   connecter : BOOT + RESET + relâche BOOT.
4. Ferme qFlipper avant `ufbt`.
5. Protocole texte ligne-à-ligne, push d'état complet à chaque évènement.

Le code de `esp32-quiz/src/main.cpp` et `apps/quiz_master/quiz_master.c` est un
exemple complet directement réutilisable.
