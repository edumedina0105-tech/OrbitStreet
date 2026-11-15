#include "SensorManager.h"
#include "Config.h"
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <DHT.h>

void* SensorManager::bme = nullptr;
void* SensorManager::dht = nullptr;
int   SensorManager::adcPin = -1;

bool SensorManager::begin() {
    String type = Config::sensorType;

    if (type == "bme280") {
        Wire.begin(Config::pinSda, Config::pinScl);
        Adafruit_BME280* sensor = new Adafruit_BME280();
        // Dirección I²C: 0x76 (común) o 0x77 (algunos módulos)
        if (!sensor->begin(0x76, &Wire) && !sensor->begin(0x77, &Wire)) {
            Serial.println("[SENSOR] BME280 no encontrado. Verifica SDA/SCL.");
            delete sensor;
            return false;
        }
        bme = sensor;
        Serial.printf("[SENSOR] BME280 OK (SDA=%d SCL=%d)\n",
            Config::pinSda, Config::pinScl);
        return true;
    }

    if (type == "dht11" || type == "dht22") {
        uint8_t dhtType = (type == "dht11") ? DHT11 : DHT22;
        DHT* sensor = new DHT(Config::pinDht, dhtType);
        sensor->begin();
        dht = sensor;
        Serial.printf("[SENSOR] %s OK (GPIO=%d)\n",
            type == "dht11" ? "DHT11" : "DHT22", Config::pinDht);
        return true;
    }

    if (type == "b3950") {
        adcPin = Config::pinDht;
        // Configurar ADC con atenuación de 11 dB (rango 0-3.3V)
        analogReadResolution(12);
        analogSetAttenuation(ADC_11db);
        Serial.printf("[SENSOR] B3950 termistor OK (GPIO=%d ADC)\n", adcPin);
        return true;
    }

    if (type == "none") {
        Serial.println("[SENSOR] Sin sensor físico. Solo baseline NASA.");
        return true;
    }

    Serial.printf("[SENSOR] Tipo desconocido: %s\n", type.c_str());
    return false;
}

SensorReading SensorManager::read() {
    SensorReading r = {0};
    r.sensorName = Config::sensorType;
    r.valid = false;

    if (Config::sensorType == "bme280" && bme) {
        Adafruit_BME280* sensor = (Adafruit_BME280*)bme;
        r.temperature = sensor->readTemperature() + Config::offsetTemp;
        r.humidity    = sensor->readHumidity()    + Config::offsetHum;
        r.pressure    = sensor->readPressure() / 100.0 + Config::offsetPress; // Pa → hPa
        r.hasHumidity = true;
        r.hasPressure = true;
        r.valid = !isnan(r.temperature) && r.temperature > -90 && r.temperature < 60;
    }
    else if ((Config::sensorType == "dht11" || Config::sensorType == "dht22") && dht) {
        DHT* sensor = (DHT*)dht;
        r.temperature = sensor->readTemperature() + Config::offsetTemp;
        r.humidity    = sensor->readHumidity()    + Config::offsetHum;
        r.hasHumidity = true;
        r.valid = !isnan(r.temperature) && r.temperature > -90 && r.temperature < 60;
    }
    else if (Config::sensorType == "b3950" && adcPin >= 0) {
        // Termistor NTC 10kΩ B3950 con divisor de tensión:
        //   R_fixed = 10 kΩ a 3.3V, termistor a GND.
        //   R_therm = R_fixed * (4095 / adc_raw - 1)
        //   T (°C) = 1 / (1/298.15 + ln(R_therm/10000)/3950) - 273.15
        int raw = analogRead(adcPin);
        if (raw > 0 && raw < 4095) {
            float rTherm = 10000.0 * (4095.0 / (float)raw - 1.0);
            // Steinhart-Hart simplificada (beta = 3950 K)
            float tKelvin = 1.0 / (1.0/298.15 + log(rTherm/10000.0)/3950.0);
            r.temperature = tKelvin - 273.15 + Config::offsetTemp;
            r.valid = r.temperature > -40 && r.temperature < 85;
        }
    }

    return r;
}

String SensorManager::getType() {
    return Config::sensorType;
}

String SensorManager::getWiring() {
    String type = Config::sensorType;
    if (type == "bme280")
        return "BME280 I2C: SDA→GPIO" + String(Config::pinSda) +
               " SCL→GPIO" + String(Config::pinScl) + " VCC→3.3V GND→GND";
    if (type == "dht11" || type == "dht22")
        return String(type == "dht11" ? "DHT11" : "DHT22") +
               ": DATA→GPIO" + String(Config::pinDht) + " VCC→3.3V GND→GND";
    if (type == "b3950")
        return "B3950: Termistor→GPIO" + String(Config::pinDht) +
               " + resistencia 10kΩ a 3.3V";
    return "Sin sensor físico";
}
