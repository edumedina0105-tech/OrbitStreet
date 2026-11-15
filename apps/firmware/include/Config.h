#pragma once
/**
 * OrbitStreet — Config.h
 *
 * Configuración persistente en LittleFS (config.json).
 * El asistente de primera configuración (dashboard web del ESP32) la
 * escribe; este módulo la lee y la expone.
 *
 * Estructura de config.json:
 * {
 *   "wifi_ssid": "...",
 *   "wifi_pass": "...",
 *   "server_url": "https://orbitstreet.up.railway.app",
 *   "station_token": "...",      // asignado al registrar la estación
 *   "sensor_type": "bme280",     // bme280 | dht11 | dht22 | b3950 | none
 *   "sensor_pin_sda": 21,        // I2C SDA (solo BME280)
 *   "sensor_pin_scl": 22,        // I2C SCL (solo BME280)
 *   "sensor_pin_dht": 4,        // GPIO del DHT o B3950 (ADC)
 *   "sensor_offset_temp": 0.0,  // calibración software (auto-calentamiento)
 *   "sensor_offset_hum": 0.0,
 *   "sensor_offset_press": 0.0,
 *   "latitude": -25.26,
 *   "longitude": -57.53,
 *   "telemetry_interval_min": 5, // minutos entre envíos al servidor
 *   "read_interval_s": 30,       // segundos entre lecturas del sensor
 *   "configured": true           // false hasta que pase el asistente
 * }
 */

#include <ArduinoJson.h>
#include <LittleFS.h>
#include <WString.h>

#define CONFIG_FILE "/config.json"
#define FS LittleFS

class Config {
public:
    // --- Estado actual (defaults hasta que se carga) ---
    static String wifiSsid;
    static String wifiPass;
    static String serverUrl;
    static String stationToken;
    static String sensorType;
    static int    pinSda;
    static int    pinScl;
    static int    pinDht;
    static float  offsetTemp;
    static float  offsetHum;
    static float  offsetPress;
    static float  latitude;
    static float  longitude;
    static int    telemetryIntervalMin;
    static int    readIntervalS;
    static bool   configured;

    // --- Gestión ---
    static bool begin();          // montar LittleFS + cargar config
    static bool load();           // leer config.json → variables
    static bool save();           // variables → config.json
    static bool isConfigured() { return configured; }
    static void resetToDefaults();
};
