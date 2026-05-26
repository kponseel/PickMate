// SoftAP + DNS catch-all (the network plumbing every game module reuses).
//
// Captive-portal HTTP probe handling lives in main.cpp / web_server for now
// because it needs access to the embedded SPA. This module only owns the
// Wi-Fi access point and DNS server.
#pragma once

#include <stdint.h>

#define WIFI_PORTAL_DEFAULT_MAX_CONN 8  // ESP32-S2 SoftAP practical ceiling

// Bring up the open or WPA2 access point at 192.168.4.1, plus a DNS catch-all
// that resolves any domain to us (so phones can be captured by the portal or
// reach the SPA at http://192.168.4.1/).
//
//  ssid     : visible network name (e.g. "GamesHub")
//  pass     : NULL for open network, or 8+ char string for WPA2
//  max_conn : stations cap (default 8, hard ceiling ~10 on ESP32-S2)
void wifi_portal_begin(const char* ssid,
                       const char* pass     = nullptr,
                       uint8_t     max_conn = WIFI_PORTAL_DEFAULT_MAX_CONN);

// Call from loop(): pumps the DNS server.
void wifi_portal_poll();
