#include "TelemetryClient.h"
#include "Config.h"
#include "WiFiManager.h"
#include <LittleFS.h>
#include <time.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>

// --- Buffer de reconexión (ring buffer estático en RAM) ---
struct QueuedRecord {
    uint32_t ts;        // epoch segundos
    float temperature;
    float humidity;
    float pressure;
    bool  hasHum;
    bool  hasPress;
};

#define QUEUE_SIZE 64
static QueuedRecord s_queue[QUEUE_SIZE];
static int s_queueHead = 0;
static int s_queueCount = 0;

// --- Baseline NASA (normales mensuales) ---
#define BASELINE_FILE "/baseline.json"
static float s_monthlyNormals[12] = {0};
static bool  s_baselineLoaded = false;

// ============================================================
// Hora NTP
// ============================================================

void TelemetryClient::syncTime() {
    // NTP de pool.ntp.org con zona UTC (los timestamps del servidor son UTC).
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

bool TelemetryClient::timeValid() {
    return epochSeconds() > 1600000000; // después de sep-2020
}

uint32_t TelemetryClient::epochSeconds() {
    time_t now = time(nullptr);
    return (now > 0) ? (uint32_t)now : 0;
}

// ============================================================
// Publicaci�n de telemetr�a (POST /api/station/telemetry)
// ============================================================

static void queuePush(const QueuedRecord& r) {
    if (s_queueCount >= QUEUE_SIZE) {
        // Buffer lleno: descartar el m�s viejo (pol�tica FIFO).
        s_queueHead = (s_queueHead + 1) % QUEUE_SIZE;
        s_queueCount--;
    }
    int tail = (s_queueHead + s_queueCount) % QUEUE_SIZE;
    s_queue[tail] = r;
    s_queueCount++;
}

bool TelemetryClient::postRecords(uint8_t* json, size_t len) {
    String url = Config::serverUrl;
    // Tolerar serverUrl con o sin barra final.
    if (!url.endsWith("/")) url += "/";
    url += "api/station/telemetry";

    WiFiClient client; // para https sin certificado en RAM limitada
    HTTPClient http;
    if (!http.begin(url)) return false;

    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", "Bearer " + Config::stationToken);
    http.setTimeout(8000);

    int code = http.POST(json, len);
    http.end();

    return code == 200;
}

bool TelemetryClient::flushBuffer() {
    if (s_queueCount == 0) return true;

    // Enviar de a lotes de hasta 16 registros (l�mite server: 60).
    int toSend = (s_queueCount > 16) ? 16 : s_queueCount;

    JsonDocument doc;
    JsonArray records = doc["records"].to<JsonArray>();
    for (int i = 0; i < toSend; i++) {
        const QueuedRecord& r = s_queue[(s_queueHead + i) % QUEUE_SIZE];
        JsonObject o = records.add<JsonObject>();
        o["ts"] = r.ts;
        o["t"] = serialized(String(r.temperature, 2));
        if (r.hasHum)    o["h"] = serialized(String(r.humidity, 1));
        if (r.hasPress)  o["p"] = serialized(String(r.pressure, 1));
    }

    String json;
    serializeJson(doc, json);

    if (postRecords((uint8_t*)json.c_str(), json.length())) {
        s_queueHead = (s_queueHead + toSend) % QUEUE_SIZE;
        s_queueCount -= toSend;
        Serial.printf("[TELEMETRY] Lote aceptado (%d). Pendientes: %d\n", toSend, s_queueCount);
        return true;
    }

    Serial.println("[TELEMETRY] Envio rechazado; se reintentara.");
    return false;
}

bool TelemetryClient::publish(const SensorReading& r) {
    if (!r.valid) return false;

    // Sin hora NTP no se puede etiquetar la lectura: se descarta
    // (mejor perder un punto que mentir sobre su fecha).
    uint32_t ts = epochSeconds();
    if (ts == 0) {
        Serial.println("[TELEMETRY] Reloj NTP sin ajustar; lectura descartada.");
        return false;
    }

    QueuedRecord q = { ts, r.temperature, r.humidity, r.pressure,
                       r.hasHumidity, r.hasPressure };
    queuePush(q);

    if (!WiFiManager::isConnected()) {
        Serial.printf("[TELEMETRY] Sin WiFi. En cola: %d\n", s_queueCount);
        return false; // queda en el buffer para cuando haya conexi�n
    }

    return flushBuffer();
}

int TelemetryClient::pendingCount() {
    return s_queueCount;
}

// ============================================================
// Baseline NASA (F3): normales mensuales en LittleFS
// ============================================================

bool TelemetryClient::refreshBaseline() {
    // Cargar baseline previa si existe (vale aunque falle la descarga).
    if (!s_baselineLoaded && FS.exists(BASELINE_FILE)) {
        File f = FS.open(BASELINE_FILE, "r");
        if (f) {
            JsonDocument doc;
            if (deserializeJson(doc, f) == DeserializationError::Ok) {
                JsonArray months = doc["months"].as<JsonArray>();
                if (months.size() == 12) {
                    int i = 0;
                    for (JsonVariant v : months) s_monthlyNormals[i++] = v.as<float>();
                    s_baselineLoaded = true;
                }
            }
            f.close();
        }
    }

    // Descargar la baseline fresca del servidor (cacheada en PostgreSQL).
    if (WiFiManager::isConnected()) {
        String url = Config::serverUrl;
        if (!url.endsWith("/")) url += "/";
        url += "api/station/baseline?lat=" + String(Config::latitude, 4)
             + "&lon=" + String(Config::longitude, 4);

        HTTPClient http;
        if (http.begin(url)) {
            http.setTimeout(12000);
            int code = http.GET();
            if (code == 200) {
                JsonDocument doc;
                if (deserializeJson(doc, http.getString()) == DeserializationError::Ok) {
                    JsonArray months = doc["months"].as<JsonArray>();
                    if (months.size() == 12) {
                        int i = 0;
                        for (JsonVariant v : months) s_monthlyNormals[i++] = v.as<float>();
                        s_baselineLoaded = true;

                        // Persistir en LittleFS para uso offline.
                        File f = FS.open(BASELINE_FILE, "w");
                        if (f) {
                            serializeJson(doc, f);
                            f.close();
                        }
                        Serial.println("[BASELINE] Normales NASA mensuales actualizadas.");
                    }
                }
            } else {
                Serial.printf("[BASELINE] Servidor respondio %d.\n", code);
            }
            http.end();
        }
    }

    if (s_baselineLoaded) {
        Serial.printf("[BASELINE] Ene=%.1f Jul=%.1f (degC)\n",
            s_monthlyNormals[0], s_monthlyNormals[6]);
    } else {
        Serial.println("[BASELINE] Sin baseline disponible todavia.");
    }
    return s_baselineLoaded;
}

bool TelemetryClient::hasBaseline() {
    return s_baselineLoaded;
}

float TelemetryClient::anomaly(float temperature) {
    if (!s_baselineLoaded) return NAN;
    time_t now = time(nullptr);
    int month = (now > 0) ? (localtime(&now)->tm_mon) : 0; // 0 = enero
    return temperature - s_monthlyNormals[month];
}
