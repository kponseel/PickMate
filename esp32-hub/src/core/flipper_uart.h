// UART link to the Flipper Zero (line-delimited text protocol).
//
// Hardware pin mapping and rationale live in flipper_uart.cpp — DO NOT TOUCH
// the pins unless you know what you are doing (see HARDWARE.md). This header
// only exposes the transport API.
#pragma once

#include <stdint.h>

#define FLIPPER_UART_DEFAULT_BAUD 115200

// Callback fired once per fully-received line (without the trailing \n / \r).
// Runs in the loop()/main task context (not an ISR), so callees may take
// game-state mutexes and call back into the rest of the system freely.
typedef void (*flipper_command_handler_t)(const char* line);

// Initialise the UART on the board-specific pins (see .cpp). Safe to call once
// during setup().
void flipper_uart_begin(uint32_t baud = FLIPPER_UART_DEFAULT_BAUD);

// Register the line callback. Pass nullptr to disable dispatch.
void flipper_uart_set_command_handler(flipper_command_handler_t cb);

// Drain bytes from the hardware FIFO, split them into lines, and invoke the
// registered handler for each complete line. Call from loop().
void flipper_uart_poll();

// Append a raw NUL-terminated string (no newline added).
void flipper_uart_send(const char* s);

// printf-style write to the Flipper. Append your own \n.
void flipper_uart_printf(const char* fmt, ...);
