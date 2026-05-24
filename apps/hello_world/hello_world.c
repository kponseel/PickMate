#include <furi.h>
#include <gui/gui.h>
#include <input/input.h>

typedef struct {
    FuriMessageQueue* input_queue;
    ViewPort* view_port;
    Gui* gui;
} HelloWorldApp;

static void hello_world_draw_callback(Canvas* canvas, void* ctx) {
    UNUSED(ctx);
    canvas_clear(canvas);
    canvas_set_font(canvas, FontPrimary);
    canvas_draw_str(canvas, 2, 12, "Hello, Flipper!");
    canvas_set_font(canvas, FontSecondary);
    canvas_draw_str(canvas, 2, 30, "Press Back to exit");
}

static void hello_world_input_callback(InputEvent* input_event, void* ctx) {
    furi_assert(ctx);
    FuriMessageQueue* queue = ctx;
    furi_message_queue_put(queue, input_event, FuriWaitForever);
}

int32_t hello_world_app(void* p) {
    UNUSED(p);

    HelloWorldApp* app = malloc(sizeof(HelloWorldApp));
    app->input_queue = furi_message_queue_alloc(8, sizeof(InputEvent));
    app->view_port = view_port_alloc();
    view_port_draw_callback_set(app->view_port, hello_world_draw_callback, NULL);
    view_port_input_callback_set(app->view_port, hello_world_input_callback, app->input_queue);

    app->gui = furi_record_open(RECORD_GUI);
    gui_add_view_port(app->gui, app->view_port, GuiLayerFullscreen);

    InputEvent event;
    bool running = true;
    while(running) {
        if(furi_message_queue_get(app->input_queue, &event, FuriWaitForever) == FuriStatusOk) {
            if(event.type == InputTypePress && event.key == InputKeyBack) {
                running = false;
            }
        }
        view_port_update(app->view_port);
    }

    gui_remove_view_port(app->gui, app->view_port);
    furi_record_close(RECORD_GUI);
    view_port_free(app->view_port);
    furi_message_queue_free(app->input_queue);
    free(app);

    return 0;
}
