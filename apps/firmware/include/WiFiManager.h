#pragma once
/**
 * OrbitStreet — WiFiManager.h
 *
 * Gestión WiFi con modo AP+STA:
 *  - Primera vez: el ESP32 crea una red "OrbitStreet-Setup" sin
 *    contraseña en 192.168.4.1 con captive portal (DNSServer).
 *  - Tras configurar: se conecta a la red del usuario (STA) y el AP
 *    se apaga automáticamente.
 *  - Si pierde la conexión: reintenta cada 30 s sin bloquear el loop.
 */

#include <WiFi.h>
#include <DNSServer.h>

#define AP_SSID "OrbitStreet-Setup"
#define AP_IP IPAddress(192, 168, 4, 1)

class WiFiManager {
public:
    static bool begin();
    static bool connectSTA(const String& ssid, const String& pass);
    static void startAP();
    static void stopAP();
    static bool isConnected() { return WiFi.status() == WL_CONNECTED; }
    static String getIP() { return isConnected() ? WiFi.localIP().toString() : AP_IP.toString(); }
    static void loop(uint32_t nowMs);  // reintento no bloqueante

private:
    static DNSServer dnsServer;
    static bool apActive;
    static uint32_t lastReconnectMs;
    static constexpr uint32_t RECONNECT_INTERVAL_MS = 30000;
};
