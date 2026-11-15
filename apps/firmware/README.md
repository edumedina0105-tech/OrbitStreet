# OrbitStreet — Nodo en Tierra (ESP32 Firmware)

Firmware PlatformIO para el nodo de ciencia ciudadana de OrbitStreet.
El ESP32 sirve su propio dashboard web embebido, lee sensores
ambientales y envía telemetría al servidor.

## Requisitos

- **ESP32 Dev Module** (WROOM-32) o **ESP32-C3 Super Mini**
- Sensor opcional: BME280 (I²C), DHT11, DHT22, o termistor B3950
- Cable USB (con datos, no solo carga)
- VS Code con extensión PlatformIO

## Instalación (primera vez)

```bash
# 1. Compilar el firmware
pio run -e esp32dev

# 2. Subir el firmware al ESP32 (conectar por USB)
pio run -e esp32dev -t upload

# 3. Subir el dashboard HTML a LittleFS (IMPORTANTE)
pio run -e esp32dev -t uploadfs

# 4. Ver el monitor serie
pio run -e esp32dev -t monitor
```

## Primera configuración (asistente web)

1. Al flashear por primera vez, el ESP32 crea una red WiFi llamada
   **`OrbitStreet-Setup`** (sin contraseña).
2. Conecta tu móvil o PC a esa red.
3. Abre **`http://192.168.4.1`** en el navegador (captive portal).
4. Verás el asistente: elige tu red WiFi, tu sensor y su pin.
5. Al guardar, el ESP32 se conecta a tu WiFi y cierra el AP.
6. El monitor serie muestra la IP asignada (ej: `192.168.1.123`).
7. Abre esa IP en el navegador → dashboard con lecturas en vivo.

## Dashboard

| Sección | Descripción |
|---------|-------------|
| 🌡️ Temperatura | °C con offset de calibración aplicado |
| 💧 Humedad | % relativa |
| 📊 Presión | hPa |
| Estado | IP del nodo, tipo de sensor, conexión al servidor |

El dashboard se actualiza cada 3 segundos (polling con `fetch()`).

## Sensores soportados

| Tipo | Protocolo | Pines (ESP32 Dev) | Librería |
|------|-----------|-------------------|----------|
| **BME280** | I²C | SDA=GPIO21, SCL=GPIO22 | Adafruit BME280 |
| **DHT11** | 1-wire digital | Cualquier GPIO | Adafruit DHT |
| **DHT22/AM2302** | 1-wire digital | Cualquier GPIO | Adafruit DHT |
| **B3950** | Analógico (ADC) | Cualquier GPIO con ADC | (Steinhart-Hart) |
| **Ninguno** | — | — | Solo baseline NASA |

## Calibración (offsets software)

El BME280 sufre auto-calentamiento del chip (+1 a +2 °C). Para
compensar: compara con un termómetro de referencia y ajusta el offset
desde el dashboard (⚙️ Configuración).

## Telemetría al servidor (F4 — pendiente)

Cuando el nodo esté conectado a WiFi y registrado en el servidor
OrbitStreet, enviará telemetría cada N minutos:

```
POST /api/station/telemetry
{
  "token": "<token-de-estación>",
  "timestamp": "2026-11-15T12:00:00Z",
  "temperature": 25.3,
  "humidity": 60.2,
  "pressure": 1013.5,
  "nasaBias": 1.2,
  "quality": "UNVALIDATED"
}
```

## Estructura del código

```
apps/firmware/
├── platformio.ini          # Entornos de compilación (esp32dev, esp32-c3)
├── include/
│   ├── Config.h            # Configuración persistente (LittleFS)
│   └── WiFiManager.h       # AP+STA con captive portal
├── src/
│   ├── main.cpp            # Entry point: loop no bloqueante
│   ├── Config.cpp          # Lectura/escritura de config.json
│   └── WiFiManager.cpp     # Gestión WiFi con reintentos
└── data/
    └── index.html          # Dashboard web (se comprime a .gz en LittleFS)
```

## Placas compatibles

| Placa | Puerto típico | Notas |
|-------|--------------|-------|
| ESP32 Dev Module (WROOM-32) | COM4 | 2 núcleos, 520 KB RAM, I²C en GPIO 21/22 |
| ESP32-C3 Super Mini | COM31 | 1 núcleo RISC-V, USB-C nativo, más barato |

## Licencia

Apache-2.0 (heredada del proyecto OrbitStreet).
