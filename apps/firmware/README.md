# OrbitStreet — Nodo en Tierra (ESP32 Firmware)

Firmware PlatformIO para el nodo de ciencia ciudadana de OrbitStreet.
El ESP32 sirve su propio dashboard web embebido, lee sensores
ambientales y envía telemetría firmada al servidor, donde se compara
con la línea base NASA.

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
4. Verás el asistente: elige tu red WiFi, tu sensor y sus pines.
5. Al guardar, el ESP32 se conecta a tu WiFi y cierra el AP.
6. El monitor serie muestra la IP asignada (ej: `192.168.1.123`).
7. Abre esa IP en el navegador → dashboard con lecturas en vivo.

## Conectar el nodo a la plataforma (telemetría + baseline NASA)

1. En la web de OrbitStreet: menú de cuenta → pestaña **«Estación»** →
   registra tu nodo (nombre + coordenadas + sensor).
2. Copia el **token de ingesta** (se muestra UNA sola vez; si lo pierdes,
   vuelve a registrar la estación para rotarlo).
3. En el dashboard del ESP32, pega el token en **«Token de estación»**
   junto con la URL del servidor.
4. El nodo entonces:
   - Sincroniza su reloj por **NTP** (sin hora válida no envía nada:
     mejor perder un punto que mentir sobre su fecha).
   - Envía telemetría firmada con el token cada N minutos:
     `POST /api/station/telemetry` con header `Authorization: Bearer …`
     y lotes de hasta 60 registros `{ts, t, h, p}`.
   - Si no hay WiFi, las lecturas quedan en un **buffer de reconexión**
     (64 registros en RAM) y se reenvían al reconectar.
   - Descarga la **baseline NASA** (normales mensuales de temperatura,
     `GET /api/station/baseline`) y la guarda en LittleFS
     (`baseline.json`), refrescándola una vez al día.
   - Calcula la **anomalía offline**: `ΔT = temperatura − normal del mes`,
     visible en el dashboard (tarjeta «ΔT vs NASA») y en el monitor serie.

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
desde la configuración (`sensor_offset_temp` en `config.json`).

## Estructura del código

```
apps/firmware/
├── platformio.ini          # Entornos (esp32dev, esp32-c3) + gzip pre-build
├── include/
│   ├── Config.h            # Configuración persistente (LittleFS)
│   ├── WiFiManager.h       # AP+STA con captive portal
│   ├── SensorManager.h     # Drivers de sensores
│   └── TelemetryClient.h   # NTP + telemetría + baseline NASA
├── src/
│   ├── main.cpp            # Entry point: loop no bloqueante + rutas web
│   ├── Config.cpp          # Lectura/escritura de config.json
│   ├── WiFiManager.cpp     # Gestión WiFi con reintentos
│   ├── SensorManager.cpp   # BME280 / DHT11 / DHT22 / B3950
│   └── TelemetryClient.cpp # Buffer de reconexión + POST + baseline
├── scripts/
│   └── gzip_data.py        # Comprime data/*.html → .gz antes del build
└── data/
    └── index.html          # Dashboard web (servido comprimido desde LittleFS)
```

Regla del proyecto: **cero `delay()` en el loop** (solo transiciones
críticas: guardar config / reiniciar). Todo usa `millis()`.

## Placas compatibles

| Placa | Puerto típico | Notas |
|-------|--------------|-------|
| ESP32 Dev Module (WROOM-32) | COM4 | 2 núcleos, 520 KB RAM, I²C en GPIO 21/22 |
| ESP32-C3 Super Mini | COM31 | 1 núcleo RISC-V, USB-C nativo, más barato |

## Licencia

Apache-2.0 (heredada del proyecto OrbitStreet).
