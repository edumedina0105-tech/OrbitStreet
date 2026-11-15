/**
 * OrbitStreet — Nodo en tierra (Ground Truth Node) v0.1.0
 *
 * Firmware ESP32 con dashboard web embebido:
 *  - Primera vez: AP "OrbitStreet-Setup" + captive portal → asistente
 *  - Tras configurar: STA + dashboard en http://<ip-del-esp>/
 *  - Lectura periódica del sensor configurado (sin delay() en el loop).
 *  - Telemetría al servidor OrbitStreet.
 */

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
#include "Config.h"
#include "WiFiManager.h"
#include "SensorManager.h"
#include "TelemetryClient.h"

AsyncWebServer server(80);

static uint32_t g_lastReadMs = 0;
static SensorReading g_lastReading;
static uint32_t g_lastTelemetryMs = 0;
static uint32_t g_lastBaselineMs = 0;
static bool g_ntpStarted = false;
static float g_anomaly = NAN; // °C respecto a la normal NASA del mes

void setupRoutes();
void readSensor();
void sendTelemetry(uint32_t nowMs);

void setup() {
    Serial.begin(115200);
    Serial.printf("\n\n=== OrbitStreet Ground Truth Node v%s ===\n\n", ORBITSTREET_VERSION);

    if (!Config::begin()) {
        Serial.println("[MAIN] Sin configuración. Primera vez.");
    }

    WiFiManager::begin();

    if (Config::configured) {
        if (!SensorManager::begin()) {
            Serial.println("[MAIN] Sensor no inicializado. Revisar wiring.");
        }
    }

    setupRoutes();
    server.begin();
    Serial.println("[MAIN] Servidor web en puerto 80.");
    Serial.printf("[MAIN] IP: %s | Wiring: %s\n",
        WiFiManager::getIP().c_str(), SensorManager::getWiring().c_str());
}

void loop() {
    uint32_t nowMs = millis();
    WiFiManager::loop(nowMs);

    if (!Config::configured) return;

    // NTP: arrancar la sincronización en cuanto haya WiFi.
    if (WiFiManager::isConnected() && !g_ntpStarted) {
        g_ntpStarted = true;
        TelemetryClient::syncTime();
    }

    // Lectura del sensor cada N segundos (no bloqueante).
    if (nowMs - g_lastReadMs >= (uint32_t)(Config::readIntervalS * 1000)) {
        g_lastReadMs = nowMs;
        readSensor();
    }

    // Telemetría al servidor cada N minutos (no bloqueante).
    if (WiFiManager::isConnected() && Config::stationToken.length() > 0) {
        if (nowMs - g_lastTelemetryMs >= (uint32_t)(Config::telemetryIntervalMin * 60000)) {
            g_lastTelemetryMs = nowMs;
            sendTelemetry(nowMs);
        }
    }

    // Baseline NASA: refrescar al arrancar y luego 1 vez al día.
    if (WiFiManager::isConnected() && TelemetryClient::timeValid() &&
        (g_lastBaselineMs == 0 || nowMs - g_lastBaselineMs >= 86400000UL)) {
        g_lastBaselineMs = nowMs;
        TelemetryClient::refreshBaseline();
    }
}

void readSensor() {
    g_lastReading = SensorManager::read();
    if (g_lastReading.valid) {
        g_anomaly = TelemetryClient::anomaly(g_lastReading.temperature);
        Serial.printf("[SENSOR] T=%.1f°C", g_lastReading.temperature);
        if (g_lastReading.hasHumidity) Serial.printf(" H=%.0f%%", g_lastReading.humidity);
        if (g_lastReading.hasPressure) Serial.printf(" P=%.0f hPa", g_lastReading.pressure);
        if (!isnan(g_anomaly)) Serial.printf(" | dT vs normal NASA: %+.1fC", g_anomaly);
        Serial.println();
    } else {
        Serial.println("[SENSOR] Lectura inválida.");
    }
}

void sendTelemetry(uint32_t nowMs) {
    if (!g_lastReading.valid) return;
    TelemetryClient::publish(g_lastReading);
}

// Página amigable cuando LittleFS está vacío (dashboard ausente): explica
// la causa y la solución en HTML legible, nunca texto plano críptico.
void sendMissingDashboard(AsyncWebServerRequest *req) {
    const char* html =
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>OrbitStreet</title></head>"
        "<body style='background:#07090E;color:#e2e8f0;"
        "font-family:system-ui,sans-serif;text-align:center;"
        "padding:3rem 1rem'>"
        "<h2 style='color:#22d3ee;margin:0 0 1rem'>OrbitStreet</h2>"
        "<p style='max-width:32rem;margin:0 auto'>"
        "El firmware esta instalado, pero la memoria LittleFS esta vacia: "
        "falta el dashboard del nodo.</p>"
        "<p style='max-width:32rem;margin:1rem auto'>"
        "<b>Solucion:</b> vuelve a flashear desde "
        "<code>orbitstreet.up.railway.app/es/flash</code> (la version "
        "actual del instalador incluye la particion de datos), o con "
        "PlatformIO: <code>pio run -e esp32dev -t uploadfs</code>.</p>"
        "</body></html>";
    req->send(200, "text/html", html);
}

// Dashboard comprimido servido con la cabecera correcta: sin
// Content-Encoding: gzip el navegador DESCARGA el .gz en vez de
// renderizarlo (servirlo por serveStatic genérico no garantiza la
// cabecera; el patrón beginResponse + addHeader sí).
void sendDashboard(AsyncWebServerRequest *req) {
    if (LittleFS.exists("/index.html.gz")) {
        AsyncWebServerResponse *res =
            req->beginResponse(LittleFS, "/index.html.gz", "text/html");
        res->addHeader("Content-Encoding", "gzip");
        req->send(res);
    } else {
        sendMissingDashboard(req);
    }
}

void setupRoutes() {
    // Rutas del dashboard: raíz y alias.
    server.on("/", HTTP_GET, sendDashboard);
    server.on("/index.html", HTTP_GET, sendDashboard);

    // GET: lecturas actuales
    server.on("/api/data", HTTP_GET, [](AsyncWebServerRequest *req) {
        JsonDocument doc;
        doc["temperature"] = g_lastReading.temperature;
        doc["humidity"] = g_lastReading.humidity;
        doc["pressure"] = g_lastReading.pressure;
        doc["hasData"] = g_lastReading.valid;
        doc["hasHumidity"] = g_lastReading.hasHumidity;
        doc["hasPressure"] = g_lastReading.hasPressure;
        doc["sensorType"] = SensorManager::getType();
        doc["wiring"] = SensorManager::getWiring();
        doc["connected"] = WiFiManager::isConnected();
        doc["ip"] = WiFiManager::getIP();
        doc["configured"] = Config::configured;
        if (isnan(g_anomaly)) doc["anomaly"] = nullptr;
        else doc["anomaly"] = g_anomaly;
        doc["hasBaseline"] = TelemetryClient::hasBaseline();
        doc["pendingTelemetry"] = TelemetryClient::pendingCount();
        doc["timeValid"] = TelemetryClient::timeValid();
        String json; serializeJson(doc, json);
        req->send(200, "application/json", json);
    });

    // GET: configuración
    server.on("/api/config", HTTP_GET, [](AsyncWebServerRequest *req) {
        JsonDocument doc;
        doc["wifi_ssid"] = Config::wifiSsid;
        doc["sensor_type"] = Config::sensorType;
        doc["sensor_pin_sda"] = Config::pinSda;
        doc["sensor_pin_scl"] = Config::pinScl;
        doc["sensor_pin_dht"] = Config::pinDht;
        doc["sensor_offset_temp"] = Config::offsetTemp;
        doc["latitude"] = Config::latitude;
        doc["longitude"] = Config::longitude;
        doc["read_interval_s"] = Config::readIntervalS;
        doc["telemetry_interval_min"] = Config::telemetryIntervalMin;
        doc["server_url"] = Config::serverUrl;
        doc["stationToken"] = Config::stationToken;
        doc["configured"] = Config::configured;
        String json; serializeJson(doc, json);
        req->send(200, "application/json", json);
    });

    // POST: guardar configuración (usa onBody para el JSON crudo)
    server.on("/api/config", HTTP_POST,
        [](AsyncWebServerRequest *req) {
            // La respuesta se envía en onBody después de parsear.
        },
        NULL,
        [](AsyncWebServerRequest *req, uint8_t *data, size_t len, size_t index, size_t total) {
            static String body = "";
            if (index == 0) body = "";
            body.concat((const char*)data, len);

            if (index + len < total) return; // aún no llegó todo el body.

            JsonDocument doc;
            DeserializationError err = deserializeJson(doc, body);
            if (err != DeserializationError::Ok) {
                req->send(400, "application/json", "{\"error\":\"invalid_json\"}");
                return;
            }

            if (!doc["wifi_ssid"].isNull()) Config::wifiSsid = doc["wifi_ssid"].as<String>();
            if (!doc["wifi_pass"].isNull()) Config::wifiPass = doc["wifi_pass"].as<String>();
            if (!doc["server_url"].isNull()) Config::serverUrl = doc["server_url"].as<String>();
            if (!doc["station_token"].isNull()) Config::stationToken = doc["station_token"].as<String>();
            if (!doc["sensor_type"].isNull()) Config::sensorType = doc["sensor_type"].as<String>();
            if (!doc["sensor_pin_sda"].isNull()) Config::pinSda = doc["sensor_pin_sda"].as<int>();
            if (!doc["sensor_pin_scl"].isNull()) Config::pinScl = doc["sensor_pin_scl"].as<int>();
            if (!doc["sensor_pin_dht"].isNull()) Config::pinDht = doc["sensor_pin_dht"].as<int>();
            if (!doc["sensor_offset_temp"].isNull()) Config::offsetTemp = doc["sensor_offset_temp"].as<float>();
            if (!doc["latitude"].isNull()) Config::latitude = doc["latitude"].as<float>();
            if (!doc["longitude"].isNull()) Config::longitude = doc["longitude"].as<float>();
            if (!doc["read_interval_s"].isNull()) Config::readIntervalS = doc["read_interval_s"].as<int>();
            if (!doc["telemetry_interval_min"].isNull()) Config::telemetryIntervalMin = doc["telemetry_interval_min"].as<int>();

            Config::configured = true;
            Config::save();
            SensorManager::begin();

            req->send(200, "application/json", "{\"ok\":true}");

            // Reconectar WiFi (diferido: primero deja que la respuesta llegue).
            delay(500);
            if (Config::wifiSsid.length() > 0) {
                WiFiManager::connectSTA(Config::wifiSsid, Config::wifiPass);
            }
        }
    );

    // POST: reiniciar
    server.on("/api/reboot", HTTP_POST, [](AsyncWebServerRequest *req) {
        req->send(200, "application/json", "{\"ok\":true}");
        delay(500);
        ESP.restart();
    });

    // 404: si el dashboard no está, la página amigable lo explica;
    // para cualquier otra ruta, 404 simple.
    server.onNotFound([](AsyncWebServerRequest *req) {
        if (!LittleFS.exists("/index.html.gz")) {
            sendMissingDashboard(req);
            return;
        }
        req->send(404, "text/plain", "Not found");
    });
}
