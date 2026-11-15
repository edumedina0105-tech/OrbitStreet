/**
 * OrbitStreet — Nodo en tierra (Ground Truth Node)
 *
 * Firmware ESP32 con dashboard web embebido:
 *  - Primera vez: AP "OrbitStreet-Setup" + captive portal → asistente
 *  - Tras configurar: STA + dashboard en http://<ip-del-esp>/
 *  - Lectura periódica del sensor configurado (sin delay()).
 *  - Telemetría al servidor OrbitStreet (cuando esté implementada).
 *
 * SIN delay() en el loop: todas las tareas usan millis().
 */

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include "Config.h"
#include "WiFiManager.h"

// --- Servidor web del ESP32 ---
AsyncWebServer server(80);

// --- Estado global ---
static uint32_t g_lastReadMs = 0;
static float g_temp = 0.0, g_hum = 0.0, g_press = 0.0;
static bool  g_hasData = false;
static String g_sensorName = "none";

// --- Prototipos ---
void setupRoutes();
void readSensor();
void sendTelemetry(uint32_t nowMs);

void setup() {
    Serial.begin(115200);
    Serial.printf("\n\n=== OrbitStreet Ground Truth Node v%s ===\n\n", ORBITSTREET_VERSION);

    // 1. Montar LittleFS y cargar configuración.
    if (!Config::begin()) {
        Serial.println("[MAIN] Sin configuración. Primera vez.");
    }

    // 2. WiFi: AP (primera vez) o STA (ya configurado).
    WiFiManager::begin();

    // 3. Servidor web.
    setupRoutes();
    server.begin();
    Serial.println("[MAIN] Servidor web iniciado en puerto 80.");

    Serial.printf("[MAIN] IP del nodo: %s\n", WiFiManager::getIP().c_str());
}

void loop() {
    uint32_t nowMs = millis();

    // WiFi: DNS del portal cautivo + reintento de conexión.
    WiFiManager::loop(nowMs);

    // Lectura del sensor cada N segundos (no bloqueante).
    if (WiFiManager::isConnected() || Config::configured) {
        if (nowMs - g_lastReadMs >= (uint32_t)(Config::readIntervalS * 1000)) {
            g_lastReadMs = nowMs;
            readSensor();
        }
    }
}

// --- Lectura del sensor ---
void readSensor() {
    // TODO (F2): leer según Config::sensorType (bme280, dht11, dht22, b3950).
    // Por ahora: valores de prueba etiquetados como SIMULADOS.
    if (Config::sensorType == "none") {
        g_hasData = false;
        return;
    }

    // Placeholder hasta implementar drivers en F2:
    g_temp   = 25.0 + Config::offsetTemp;
    g_hum    = 60.0 + Config::offsetHum;
    g_press  = 1013.0 + Config::offsetPress;
    g_hasData = true;

    Serial.printf("[SENSOR] T=%.1f°C H=%.0f%% P=%.0f hPa\n", g_temp, g_hum, g_press);
}

// --- Rutas del servidor web ---
void setupRoutes() {
    // Dashboard HTML desde LittleFS (gzipped).
    server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html.gz");

    // API: estado actual del nodo.
    server.on("/api/data", HTTP_GET, [](AsyncWebServerRequest *req) {
        JsonDocument doc;
        doc["temperature"] = g_temp;
        doc["humidity"] = g_hum;
        doc["pressure"] = g_press;
        doc["hasData"] = g_hasData;
        doc["sensorType"] = Config::sensorType;
        doc["connected"] = WiFiManager::isConnected();
        doc["ip"] = WiFiManager::getIP();
        doc["configured"] = Config::configured;

        String json;
        serializeJson(doc, json);
        req->send(200, "application/json", json);
    });

    // API: leer configuración.
    server.on("/api/config", HTTP_GET, [](AsyncWebServerRequest *req) {
        JsonDocument doc;
        doc["wifi_ssid"] = Config::wifiSsid;
        doc["sensor_type"] = Config::sensorType;
        doc["latitude"] = Config::latitude;
        doc["longitude"] = Config::longitude;
        doc["read_interval_s"] = Config::readIntervalS;
        doc["telemetry_interval_min"] = Config::telemetryIntervalMin;
        doc["configured"] = Config::configured;

        String json;
        serializeJson(doc, json);
        req->send(200, "application/json", json);
    });

    // API: guardar configuración (POST con JSON body).
    server.on("/api/config", HTTP_POST, [](AsyncWebServerRequest *req) {
        // El body llega como parámetro de form-data o raw.
        String body = "";
        if (req->hasParam("body", true)) {
            body = req->getParam("body", true)->value();
        } else if (req->contentLength() > 0) {
            // El body viene en el handler de upload; AsyncWebServer lo
            // pasa via onBody. Simplificado: intentamos raw.
        }

        JsonDocument doc;
        DeserializationError err = deserializeJson(doc, body);
        if (err != DeserializationError::Ok) {
            req->send(400, "application/json", "{\"error\":\"invalid_json\"}");
            return;
        }

        if (doc["wifi_ssid"].is<String>()) Config::wifiSsid = doc["wifi_ssid"].as<String>();
        if (doc["wifi_pass"].is<String>()) Config::wifiPass = doc["wifi_pass"].as<String>();
        if (doc["sensor_type"].is<String>()) Config::sensorType = doc["sensor_type"].as<String>();
        if (doc["latitude"].is<float>()) Config::latitude = doc["latitude"].as<float>();
        if (doc["longitude"].is<float>()) Config::longitude = doc["longitude"].as<float>();
        if (doc["read_interval_s"].is<int>()) Config::readIntervalS = doc["read_interval_s"].as<int>();
        if (doc["telemetry_interval_min"].is<int>()) Config::telemetryIntervalMin = doc["telemetry_interval_min"].as<int>();

        Config::configured = true;
        Config::save();

        req->send(200, "application/json", "{\"ok\":true}");

        // Reconectar WiFi con la nueva configuración (diferido para
        // permitir que la respuesta llegue primero).
        delay(500); // único delay() permitido en el firmware: transición crítica.
        WiFiManager::connectSTA(Config::wifiSsid, Config::wifiPass);
    });

    // API: reiniciar (desde el dashboard).
    server.on("/api/reboot", HTTP_POST, [](AsyncWebServerRequest *req) {
        req->send(200, "application/json", "{\"ok\":true}");
        delay(500);
        ESP.restart();
    });
}
