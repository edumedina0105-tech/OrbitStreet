#pragma once
/**
 * OrbitStreet — SensorManager.h
 *
 * Capa de abstracción de sensores: main.cpp NO sabe qué sensor hay —
 * este módulo lee Config::sensorType y usa el driver correcto.
 *
 * Sensores soportados:
 *  - bme280: I²C (SDA/SCL configurables) — temp + hum + presión
 *  - dht11:  GPIO digital — temp + hum (precisión ±2°C)
 *  - dht22:  GPIO digital — temp + hum (precisión ±0.5°C)
 *  - b3950:  ADC (GPIO) — solo temp (termistor NTC 10kΩ)
 *  - none:   sin sensor — solo baseline NASA (datos del servidor)
 *
 * Todos aplican los offsets de calibración software de Config.
 */

#include <Arduino.h>

struct SensorReading {
    float temperature;   // °C
    float humidity;      // % (0 si el sensor no la mide)
    float pressure;      // hPa (0 si el sensor no la mide)
    bool  hasHumidity;
    bool  hasPressure;
    bool  valid;
    String sensorName;
};

class SensorManager {
public:
    static bool begin();              // inicializar el driver según config
    static SensorReading read();      // leer el sensor (con offsets aplicados)
    static String getType();          // "bme280", "dht22", etc.
    static String getWiring();        // descripción del cableado para el dashboard

private:
    // Drivers (punteros estáticos para evitar heap fragmentation)
    static void* bme;    // Adafruit_BME280*
    static void* dht;    // DHT*
    static int   adcPin; // pin del B3950
};
