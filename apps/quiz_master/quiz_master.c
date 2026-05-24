/*
 * Quiz Master - Flipper Zero companion app for the Flipper-Quiz ESP32 server.
 *
 * Talks to the ESP32 (Wi-Fi Dev Board) over UART. It displays the live game
 * state pushed by the ESP32 and lets the game master drive the round with the
 * Flipper's physical buttons:
 *   OK   -> "NEXT"  (start / reveal / next question)
 *   Down -> "RESET" (restart the game)
 *   Back -> quit
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
#define LINE_MAX        64

typedef struct {
    int  players;
    char state[16];
    char qinfo[16];
} QuizState;

typedef struct {
    Gui*                 gui;
    ViewPort*            view_port;
    FuriMessageQueue*    input_queue;
    FuriMutex*           mutex;
    FuriHalSerialHandle* serial;
    FuriThread*          worker;
    FuriStreamBuffer*    rx_stream;
    QuizState            quiz;
    volatile bool        running;
} QuizApp;

// --- UART ------------------------------------------------------------------
static void uart_rx_cb(FuriHalSerialHandle* handle, FuriHalSerialRxEvent event, void* context) {
    QuizApp* app = context;
    if(event == FuriHalSerialRxEventData) {
        uint8_t b = furi_hal_serial_async_rx(handle);
        furi_stream_buffer_send(app->rx_stream, &b, 1, 0);
    }
}

static void uart_send(QuizApp* app, const char* s) {
    furi_hal_serial_tx(app->serial, (const uint8_t*)s, strlen(s));
}

static void parse_line(QuizApp* app, const char* line) {
    furi_mutex_acquire(app->mutex, FuriWaitForever);
    if(strncmp(line, "PLAYERS:", 8) == 0) {
        app->quiz.players = atoi(line + 8);
    } else if(strncmp(line, "STATE:", 6) == 0) {
        strncpy(app->quiz.state, line + 6, sizeof(app->quiz.state) - 1);
        app->quiz.state[sizeof(app->quiz.state) - 1] = '\0';
    } else if(strncmp(line, "Q:", 2) == 0) {
        strncpy(app->quiz.qinfo, line + 2, sizeof(app->quiz.qinfo) - 1);
        app->quiz.qinfo[sizeof(app->quiz.qinfo) - 1] = '\0';
    }
    furi_mutex_release(app->mutex);
    view_port_update(app->view_port);
}

static int32_t uart_worker(void* context) {
    QuizApp* app = context;
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
    QuizApp* app = ctx;
    furi_mutex_acquire(app->mutex, FuriWaitForever);
    QuizState q = app->quiz;
    furi_mutex_release(app->mutex);

    char buf[32];
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 2, 12, "Flipper-Quiz");

    canvas_set_font(canvas, FontSecondary);
    snprintf(buf, sizeof(buf), "Joueurs: %d", q.players);
    canvas_draw_str(canvas, 2, 26, buf);
    snprintf(buf, sizeof(buf), "Etat: %s", q.state[0] ? q.state : "...");
    canvas_draw_str(canvas, 2, 38, buf);
    if(q.qinfo[0]) {
        snprintf(buf, sizeof(buf), "Question: %s", q.qinfo);
        canvas_draw_str(canvas, 2, 50, buf);
    }
    canvas_draw_str(canvas, 2, 62, "OK:Suivant  Bas:Reset");
}

static void input_cb(InputEvent* input_event, void* ctx) {
    FuriMessageQueue* queue = ctx;
    furi_message_queue_put(queue, input_event, FuriWaitForever);
}

// --- App -------------------------------------------------------------------
int32_t quiz_master_app(void* p) {
    UNUSED(p);

    QuizApp* app = malloc(sizeof(QuizApp));
    memset(app, 0, sizeof(QuizApp));
    app->running     = true;
    app->mutex       = furi_mutex_alloc(FuriMutexTypeNormal);
    app->input_queue = furi_message_queue_alloc(8, sizeof(InputEvent));
    app->rx_stream   = furi_stream_buffer_alloc(RX_STREAM_SIZE, 1);
    strcpy(app->quiz.state, "...");

    app->view_port = view_port_alloc();
    view_port_draw_callback_set(app->view_port, draw_cb, app);
    view_port_input_callback_set(app->view_port, input_cb, app->input_queue);
    app->gui = furi_record_open(RECORD_GUI);
    gui_add_view_port(app->gui, app->view_port, GuiLayerFullscreen);

    app->serial = furi_hal_serial_control_acquire(FuriHalSerialIdUsart);
    furi_check(app->serial);
    furi_hal_serial_init(app->serial, UART_BAUD);
    furi_hal_serial_async_rx_start(app->serial, uart_rx_cb, app, false);

    app->worker = furi_thread_alloc_ex("QuizUartWorker", 2048, uart_worker, app);
    furi_thread_start(app->worker);

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
    furi_thread_join(app->worker);
    furi_thread_free(app->worker);

    furi_hal_serial_async_rx_stop(app->serial);
    furi_hal_serial_deinit(app->serial);
    furi_hal_serial_control_release(app->serial);

    gui_remove_view_port(app->gui, app->view_port);
    furi_record_close(RECORD_GUI);
    view_port_free(app->view_port);

    furi_message_queue_free(app->input_queue);
    furi_stream_buffer_free(app->rx_stream);
    furi_mutex_free(app->mutex);
    free(app);
    return 0;
}
