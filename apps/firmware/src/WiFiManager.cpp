#include "WiFiManager.h"
#include "Config.h"

DNSServer WiFiManager::dnsServer;
bool WiFiManager::apActive = false;
uint32_t WiFiManager::lastReconnectMs = 0;

bool WiFiManager::begin() {
    if (Config::configured && Config::wifiSsid.length() > 0) {
        // Ya configurado: conectar directo a la red del usuario.
        Serial.printf("[WIFI] Conectando a '%s'...\n", Config::wifiSsid.c_str());
        return connectSTA(Config::wifiSsid, Config::wifiPass);
    }
    // Primera vez: levantar AP con captive portal.
    Serial.println("[WIFI] Primera vez: modo AP con portal cautivo.");
    startAP();
    return false;
}

bool WiFiManager::connectSTA(const String& ssid, const String& pass) {
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());

    // Esperar hasta 15 s (no bloqueante: el usuario ve el estado).
    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
        delay(100);
        yield();
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[WIFI] Conectado a %s. IP: %s\n",
            ssid.c_str(), WiFi.localIP().toString().c_str());
        stopAP();
        return true;
    }

    Serial.println("[WIFI] No se pudo conectar. Volviendo a AP.");
    startAP();
    return false;
}

void WiFiManager::startAP() {
    if (apActive) return;
    WiFi.mode(WIFI_AP);
    WiFi.softAPConfig(AP_IP, AP_IP, IPAddress(255, 255, 255, 0));
    WiFi.softAP(AP_SSID);  // sin contraseña: el usuario se conecta desde el móvil
    apActive = true;

    // Captive portal: toda petición DNS cae en la IP del ESP32.
    dnsServer.start(53, "*", AP_IP);

    Serial.printf("[WIFI] AP activo: '%s' en %s\n", AP_SSID, AP_IP.toString().c_str());
    Serial.println("[WIFI] Conecta tu móvil a esta red y abre 192.168.4.1");
}

void WiFiManager::stopAP() {
    if (!apActive) return;
    dnsServer.stop();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    apActive = false;
    Serial.println("[WIFI] AP cerrado. Modo STA.");
}

void WiFiManager::loop(uint32_t nowMs) {
    // Procesar DNS del captive portal mientras el AP esté activo.
    if (apActive) {
        dnsServer.processNextRequest();
        return;
    }

    // Reintento no bloqueante si perdió la conexión.
    if (!isConnected() && nowMs - lastReconnectMs >= RECONNECT_INTERVAL_MS) {
        lastReconnectMs = nowMs;
        Serial.println("[WIFI] Reconectando...");
        WiFi.reconnect();
    }
}
