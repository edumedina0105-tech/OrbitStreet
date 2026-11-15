# Demo ESP32 — Guion de defensa (2 minutos)

**Preparación (antes de la demo):** ESP32 Dev (WROOM-32) + DHT11/DHT22
conectado, cableado: **DATA → GPIO4**, VCC → 3.3V, GND → GND. Firmware
flasheado, dashboard en LittleFS, red del ESP conectada al WiFi.

---

## Guion

**0. Apertura (10 s)**
> "Los satélites miden celdas de ~50 km. OrbitStreet agrega un testigo en
> tierra: un ESP32 de ~5 dólares que mide exactamente donde vivís."

**1. Lectura real en vivo (30 s)**
- Abrir `http://<ip-del-esp>/` en el navegador.
> "Estas son lecturas REALES del DHT — temperatura y humedad de esta
> habitación, ahora mismo. Cero simulación: si no hay sensor, no hay dato."

**2. La línea base NASA en la memoria del nodo (30 s)**
- Mostrar la tarjeta **"ΔT vs normal NASA"**.
> "El nodo descargó de la plataforma la climatología mensual de NASA POWER
> para SU ubicación y la guardó en memoria flash. Ahora compara su lectura
> contra la normal del mes actual: es una referencia histórica — una lectura
> instantánea NO demuestra una tendencia climática, y no lo afirmamos."

**3. Telemetría firmada → la plataforma (40 s)**
- Abrir la DB (o el panel "Estación" en la web) y mostrar los registros.
> "Cada pocos minutos el nodo envía telemetría firmada con su token único —
> el servidor guarda solo el hash. Sin hora NTP válida no envía nada: mejor
> perder un punto que mentir sobre su fecha. Si se corta el WiFi, las
> lecturas quedan en cola y se reenvían solas."

**4. Cierre: por qué importa (20 s)**
> "Esto convierte a cualquier persona en científico ciudadano: su calle se
> vuelve dato certificado, comparable contra la referencia de la NASA. Y el
> análisis de tendencias — lo que el desafío pide — sigue siendo el motor
> determinista validado contra pymannkendall y SciPy."

---

## Cableado (referencia)

| DHT | ESP32 Dev (WROOM-32) |
|---|---|
| VCC | 3.3V (VIN si el módulo lleva placa) |
| DATA | GPIO 4 |
| GND | GND |

DHT22/AM2302 en módulo de 3 pines: no necesita resistencia externa.
DHT11/dígitos sueltos: resistencia pull-up 10 kΩ entre VCC y DATA.

## Flasheo

```bash
cd apps/firmware
pio run -e esp32dev -t upload     # firmware
pio run -e esp32dev -t uploadfs   # dashboard en LittleFS
pio run -e esp32dev -t monitor    # monitor serie (Ctrl+] para salir)
```

Primera vez: red **`OrbitStreet-Setup`** → `http://192.168.4.1` →
asistente (WiFi, sensor **DHT22 GPIO 4**, coordenadas, token).

## Checklist pre-demo

- [ ] Sensor conectado (DATA → GPIO 4)
- [ ] Firmware + dashboard flasheados
- [ ] Asistente completado (WiFi + sensor + coordenadas + token)
- [ ] Baseline NASA descargada (tarjeta ΔT con número, no "—")
- [ ] Telemetría llegando a la DB (ver en SQL: `SELECT * FROM
      "TelemetryRecord" ORDER BY timestamp DESC LIMIT 5;`)
- [ ] NTP sincronizado (sin aviso de "reloj" en el dashboard)