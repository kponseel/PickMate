// UART transport to the Flipper Zero.
//
// =============================================================================
//  PINOUT — DO NOT CHANGE WITHOUT READING HARDWARE.md
// =============================================================================
//  On the official Flipper Wi-Fi Developer Board (Model WD), the ESP32-S2's
//  native UART0 pins (GPIO 43/44) are routed to the Flipper's USART pins:
//
//      ESP32-S2 GPIO 43 (TX) --> Flipper pin 14 (USART RX)
//      ESP32-S2 GPIO 44 (RX) <-- Flipper pin 13 (USART TX)
//
//  Anything else will silently fail. The Arduino HardwareSerial(1) object
//  below routes UART1 (free thanks to ARDUINO_USB_CDC_ON_BOOT=1) onto these
//  GPIOs via the ESP32 GPIO matrix.
// =============================================================================
#include "flipper_uart.h"

#include <Arduino.h>
#include <stdarg.h>
#include <string.h>

#define FLIPPER_UART_RX_PIN 44  // <- Flipper pin 13 (TX)
#define FLIPPER_UART_TX_PIN 43  // -> Flipper pin 14 (RX)

#define LINE_BUFFER_MAX 64

static HardwareSerial             FlipperSerial(1);
static flipper_command_handler_t  s_handler = nullptr;
static char                       s_line[LINE_BUFFER_MAX];
static size_t                     s_line_len = 0;

void flipper_uart_begin(uint32_t baud) {
    FlipperSerial.begin(baud, SERIAL_8N1, FLIPPER_UART_RX_PIN, FLIPPER_UART_TX_PIN);
}

void flipper_uart_set_command_handler(flipper_command_handler_t cb) {
    s_handler = cb;
}

void flipper_uart_poll() {
    while (FlipperSerial.available()) {
        char c = (char)FlipperSerial.read();
        if (c == '\n' || c == '\r') {
            if (s_line_len > 0) {
                s_line[s_line_len] = '\0';
                if (s_handler) s_handler(s_line);
            }
            s_line_len = 0;
        } else if (s_line_len < LINE_BUFFER_MAX - 1) {
            s_line[s_line_len++] = c;
        } else {
            // overflow: discard the partial line to resync
            s_line_len = 0;
        }
    }
}

void flipper_uart_send(const char* s) {
    if (!s) return;
    FlipperSerial.write((const uint8_t*)s, strlen(s));
}

void flipper_uart_printf(const char* fmt, ...) {
    char buf[128];
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    if (n > 0) {
        if (n > (int)sizeof(buf) - 1) n = sizeof(buf) - 1;
        FlipperSerial.write((const uint8_t*)buf, n);
    }
}
