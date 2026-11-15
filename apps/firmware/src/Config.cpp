#include "Config.h"

// Defaults (se sobreescriben al cargar config.json)
String Config::wifiSsid = "";
String Config::wifiPass = "";
String Config::serverUrl = "https://orbitstreet.up.railway.app";
String Config::stationToken = "";
String Config::sensorType = "none";
int    Config::pinSda = 21;
int    Config::pinScl = 22;
int    Config::pinDht = 4;
float  Config::offsetTemp = 0.0;
float  Config::offsetHum = 0.0;
float  Config::offsetPress = 0.0;
float  Config::latitude = 0.0;
float  Config::longitude = 0.0;
int    Config::telemetryIntervalMin = 5;
int    Config::readIntervalS = 30;
bool   Config::configured = false;

bool Config::begin() {
    if (!FS.begin(true)) {
        Serial.println("[CONFIG] Error montando LittleFS.");
        return false;
    }
    return load();
}

bool Config::load() {
    if (!FS.exists(CONFIG_FILE)) {
        Serial.println("[CONFIG] No existe config.json (primera vez).");
        return false;
    }

    File file = FS.open(CONFIG_FILE, "r");
    if (!file) {
        Serial.println("[CONFIG] Error abriendo config.json.");
        return false;
    }

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, file);
    file.close();

    if (err != DeserializationError::Ok) {
        Serial.printf("[CONFIG] Error parseando JSON: %s\n", err.c_str());
        return false;
    }

    wifiSsid   = doc["wifi_ssid"] | "";
    wifiPass   = doc["wifi_pass"] | "";
    serverUrl  = doc["server_url"] | "https://orbitstreet.up.railway.app";
    stationToken = doc["station_token"] | "";
    sensorType = doc["sensor_type"] | "none";
    pinSda     = doc["sensor_pin_sda"] | 21;
    pinScl     = doc["sensor_pin_scl"] | 22;
    pinDht     = doc["sensor_pin_dht"] | 4;
    offsetTemp  = doc["sensor_offset_temp"] | 0.0;
    offsetHum   = doc["sensor_offset_hum"] | 0.0;
    offsetPress = doc["sensor_offset_press"] | 0.0;
    latitude  = doc["latitude"] | 0.0;
    longitude = doc["longitude"] | 0.0;
    telemetryIntervalMin = doc["telemetry_interval_min"] | 5;
    readIntervalS = doc["read_interval_s"] | 30;
    configured = doc["configured"] | false;

    Serial.printf("[CONFIG] Cargada: sensor=%s ssid=%s lat=%.2f lon=%.2f\n",
        sensorType.c_str(), wifiSsid.c_str(), latitude, longitude);
    return true;
}

bool Config::save() {
    JsonDocument doc;
    doc["wifi_ssid"] = wifiSsid;
    doc["wifi_pass"] = wifiPass;
    doc["server_url"] = serverUrl;
    doc["station_token"] = stationToken;
    doc["sensor_type"] = sensorType;
    doc["sensor_pin_sda"] = pinSda;
    doc["sensor_pin_scl"] = pinScl;
    doc["sensor_pin_dht"] = pinDht;
    doc["sensor_offset_temp"] = offsetTemp;
    doc["sensor_offset_hum"] = offsetHum;
    doc["sensor_offset_press"] = offsetPress;
    doc["latitude"] = latitude;
    doc["longitude"] = longitude;
    doc["telemetry_interval_min"] = telemetryIntervalMin;
    doc["read_interval_s"] = readIntervalS;
    doc["configured"] = configured;

    File file = FS.open(CONFIG_FILE, "w");
    if (!file) {
        Serial.println("[CONFIG] Error creando config.json.");
        return false;
    }
    serializeJson(doc, file);
    file.close();
    Serial.println("[CONFIG] Configuración guardada.");
    return true;
}

void Config::resetToDefaults() {
    wifiSsid = "";
    wifiPass = "";
    stationToken = "";
    sensorType = "none";
    offsetTemp = 0.0;
    offsetHum = 0.0;
    offsetPress = 0.0;
    latitude = 0.0;
    longitude = 0.0;
    configured = false;
    save();
}
