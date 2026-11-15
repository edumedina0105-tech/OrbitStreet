#pragma once
/**
 * OrbitStreet — TelemetryClient.h (F4 + F3)
 *
 * Sube telemetría al servidor OrbitStreet y mantiene la línea base NASA.
 *
 *  - Hora NTP: sin hora válida no se envía nada (evita timestamps falsos).
 *  - Buffer de reconexión: si el envío falla, la lectura queda en un ring
 *    buffer en RAM (64 registros) y se reintenta en el próximo ciclo.
 *  - Baseline NASA (F3): descarga las 12 normales mensuales de temperatura
 *    del servidor (que a su vez consulta NASA POWER) y las guarda en
 *    LittleFS (baseline.json). Anomalía = temp − normal del mes, offline.
 */

#include <Arduino.h>
#include "SensorManager.h"

class TelemetryClient {
public:
    /// Sincronizar reloj por NTP (llamar cuando haya WiFi).
    static void syncTime();

    /// true si el reloj NTP ya está ajustado.
    static bool timeValid();

    /// Epoch en segundos (0 si el reloj no está ajustado).
    static uint32_t epochSeconds();

    /// Enviar la lectura actual; si falla, se acumula en el buffer.
    /// Devuelve true si llegó al servidor (o quedó en cola para reintentar).
    static bool publish(const SensorReading& r);

    /// Registros pendientes en el buffer de reconexión.
    static int pendingCount();

    /// Descargar la baseline NASA para la ubicación configurada y guardarla
    /// en LittleFS. Devuelve true si hay baseline válida (nueva o previa).
    static bool refreshBaseline();

    /// Anomalía (°C) respecto a la normal del mes actual; NAN si no hay baseline.
    static float anomaly(float temperature);

    /// Mes de la normal cargada (para el dashboard), "" si no hay.
    static bool hasBaseline();

private:
    static bool flushBuffer();
    static bool postRecords(uint8_t* json, size_t len);
};
