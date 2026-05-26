/*
 * GamesHub — Flipper Zero companion app for the GamesHub ESP32 server.
 *
 * Generic dashboard for the GamesHub party-games platform: shows live state
 * pushed by the ESP32 over UART and turns the Flipper's physical buttons
 * into host actions on whichever game is currently selected.
 *
 * Buttons (these are gamemaster controls; they bypass the H6 host gate):
 *   OK   -> "NEXT"  (start / reveal / next round / new game on hub)
 *   Down -> "RESET" (full reset)
 *   Back -> quit
 *
 * UART protocol (line-based, 115200 baud, ESP32 -> Flipper):
 *   PLAYERS:<n>         number of active players
 *   STATE:<phase>       lobby | playing | reveal | finished
 *   HOST:<name>         current host's pseudo (empty if lobby empty)
 *   GAME:<id>           selected game id (e.g. "quiz"), empty in the hub
 *   PROGRESS:<text>     game-specific progress hint (e.g. "2/5")
 *
 * Wiring: the Wi-Fi Dev Board uses the Flipper's USART (GPIO 13=TX, 14=RX).
 */

#include <furi.h>
#include <furi_hal_serial.h>
#include <furi_hal_serial_control.h>
#include <gui/gui.h>
#include <input/input.h>
#include <string.h>
#include <stdlib.h>

#define UART_BAUD       115200
#define RX_STREAM_SIZE  256
#define LINE_MAX        72
#define FIELD_MAX       28

typedef struct {
    int  players;
    char state[FIELD_MAX];
    char host[FIELD_MAX];
    char game[FIELD_MAX];
    char progress[FIELD_MAX];
} HubState;

typedef struct {
    Gui*                 gui;
    ViewPort*            view_port;
    FuriMessageQueue*    input_queue;
    FuriMutex*           mutex;
    FuriHalSerialHandle* serial;
    FuriThread*          worker;
    FuriStreamBuffer*    rx_stream;
    HubState             hub;
    volatile bool        running;
} App;

// --- UART ------------------------------------------------------------------
static void uart_rx_cb(FuriHalSerialHandle* handle, FuriHalSerialRxEvent event, void* context) {
    App* app = context;
    if(event == FuriHalSerialRxEventData) {
        uint8_t b = furi_hal_serial_async_rx(handle);
        furi_stream_buffer_send(app->rx_stream, &b, 1, 0);
    }
}

static void uart_send(App* app, const char* s) {
    if(!app->serial) return;
    furi_hal_serial_tx(app->serial, (const uint8_t*)s, strlen(s));
}

static void copy_field(char* dest, size_t cap, const char* src) {
    strncpy(dest, src, cap - 1);
    dest[cap - 1] = '\0';
}

static void parse_line(App* app, const char* line) {
    furi_mutex_acquire(app->mutex, FuriWaitForever);
    if(strncmp(line, "PLAYERS:", 8) == 0) {
        app->hub.players = atoi(line + 8);
    } else if(strncmp(line, "STATE:", 6) == 0) {
        copy_field(app->hub.state, sizeof(app->hub.state), line + 6);
    } else if(strncmp(line, "HOST:", 5) == 0) {
        copy_field(app->hub.host, sizeof(app->hub.host), line + 5);
    } else if(strncmp(line, "GAME:", 5) == 0) {
        copy_field(app->hub.game, sizeof(app->hub.game), line + 5);
    } else if(strncmp(line, "PROGRESS:", 9) == 0) {
        copy_field(app->hub.progress, sizeof(app->hub.progress), line + 9);
    }
    furi_mutex_release(app->mutex);
    view_port_update(app->view_port);
}

static int32_t uart_worker(void* context) {
    App* app = context;
    char line[LINE_MAX];
    size_t idx = 0;
    uint8_t b;
    while(app->running) {
        if(furi_stream_buffer_receive(app->rx_stream, &b, 1, 100) == 0) continue;
        if(b == '\n' || b == '\r') {
            line[idx] = '\0';
            if(idx > 0) parse_line(app, line);
            idx = 0;
        } else if(idx < LINE_MAX - 1) {
            line[idx++] = (char)b;
        }
    }
    return 0;
}

// --- GUI -------------------------------------------------------------------
static void draw_cb(Canvas* canvas, void* ctx) {
    App* app = ctx;
    furi_mutex_acquire(app->mutex, FuriWaitForever);
    HubState s = app->hub;
    furi_mutex_release(app->mutex);

    char buf[48];
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 2, 11, "GamesHub");

    canvas_set_font(canvas, FontSecondary);

    snprintf(buf, sizeof(buf), "Jeu: %s", s.game[0] ? s.game : "-");
    canvas_draw_str(canvas, 2, 23, buf);

    if(s.host[0]) {
        snprintf(buf, sizeof(buf), "Joueurs: %d  Hote: %s", s.players, s.host);
    } else {
        snprintf(buf, sizeof(buf), "Joueurs: %d", s.players);
    }
    canvas_draw_str(canvas, 2, 34, buf);

    snprintf(buf, sizeof(buf), "Etat: %s", s.state[0] ? s.state : "...");
    canvas_draw_str(canvas, 2, 45, buf);

    if(s.progress[0]) {
        snprintf(buf, sizeof(buf), "%s", s.progress);
        canvas_draw_str(canvas, 2, 56, buf);
    }

    canvas_draw_str(canvas, 2, 63, "OK:Suivant  Bas:Reset");
}

static void input_cb(InputEvent* input_event, void* ctx) {
    FuriMessageQueue* queue = ctx;
    furi_message_queue_put(queue, input_event, FuriWaitForever);
}

// --- App -------------------------------------------------------------------
int32_t gameshub_app(void* p) {
    UNUSED(p);

    App* app = malloc(sizeof(App));
    memset(app, 0, sizeof(App));
    app->running     = true;
    app->mutex       = furi_mutex_alloc(FuriMutexTypeNormal);
    app->input_queue = furi_message_queue_alloc(8, sizeof(InputEvent));
    app->rx_stream   = furi_stream_buffer_alloc(RX_STREAM_SIZE, 1);
    strcpy(app->hub.state, "...");

    app->view_port = view_port_alloc();
    view_port_draw_callback_set(app->view_port, draw_cb, app);
    view_port_input_callback_set(app->view_port, input_cb, app->input_queue);
    app->gui = furi_record_open(RECORD_GUI);
    gui_add_view_port(app->gui, app->view_port, GuiLayerFullscreen);

    app->serial = furi_hal_serial_control_acquire(FuriHalSerialIdUsart);
    if(app->serial) {
        furi_hal_serial_init(app->serial, UART_BAUD);
        furi_hal_serial_async_rx_start(app->serial, uart_rx_cb, app, false);
        app->worker = furi_thread_alloc_ex("GamesHubUart", 2048, uart_worker, app);
        furi_thread_start(app->worker);
    } else {
        // USART held by another process (qFlipper / CLI / another GPIO app):
        // surface it on screen instead of crashing on furi_check.
        copy_field(app->hub.state, sizeof(app->hub.state), "USART occupe!");
    }

    InputEvent event;
    bool running = true;
    while(running) {
        if(furi_message_queue_get(app->input_queue, &event, FuriWaitForever) == FuriStatusOk) {
            if(event.type == InputTypePress) {
                if(event.key == InputKeyBack) {
                    running = false;
                } else if(event.key == InputKeyOk) {
                    uart_send(app, "NEXT\n");
                } else if(event.key == InputKeyDown) {
                    uart_send(app, "RESET\n");
                }
            }
        }
    }

    app->running = false;
    if(app->worker) {
        furi_thread_join(app->worker);
        furi_thread_free(app->worker);
    }
    if(app->serial) {
        furi_hal_serial_async_rx_stop(app->serial);
        furi_hal_serial_deinit(app->serial);
        furi_hal_serial_control_release(app->serial);
    }

    gui_remove_view_port(app->gui, app->view_port);
    furi_record_close(RECORD_GUI);
    view_port_free(app->view_port);

    furi_message_queue_free(app->input_queue);
    furi_stream_buffer_free(app->rx_stream);
    furi_mutex_free(app->mutex);
    free(app);
    return 0;
}
