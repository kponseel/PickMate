#include "wifi_portal.h"

#include <Arduino.h>
#include <WiFi.h>
#include <DNSServer.h>

static const IPAddress AP_IP(192, 168, 4, 1);
static const IPAddress AP_GATEWAY(192, 168, 4, 1);
static const IPAddress AP_SUBNET(255, 255, 255, 0);
static const byte      DNS_PORT = 53;

static DNSServer dnsServer;

void wifi_portal_begin(const char* ssid, const char* pass, uint8_t max_conn) {
    WiFi.mode(WIFI_AP);
    WiFi.softAPConfig(AP_IP, AP_GATEWAY, AP_SUBNET);
    WiFi.softAP(ssid, pass, /*channel=*/1, /*ssid_hidden=*/0, max_conn);

    dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
    dnsServer.start(DNS_PORT, "*", AP_IP);   // resolve every domain to us

    Serial.printf("[wifi_portal] AP '%s' up at %s (max %u stations)\n",
                  ssid, WiFi.softAPIP().toString().c_str(), (unsigned)max_conn);
}

void wifi_portal_poll() {
    dnsServer.processNextRequest();
}
