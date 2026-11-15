'use client';

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Diagrama interactivo de conexiones ESP32 ↔ sensor (portado del diseño
 * de referencia "Calle vs. Cielo"). El usuario elige sensor y pin GPIO/ADC
 * y el cable de señal SE REDIBUJA animado sobre la placa DevKit.
 *
 * Los pines ofrecidos son exactamente los que acepta el asistente real
 * del firmware (campo «Pin GPIO del sensor»): DHT11/DHT22 → GPIO digital
 * 4/15/16 · B3950 → ADC1 34/35/32 (ADC2 falla con WiFi activo) ·
 * BME280 → I2C fijo 21/22.
 *
 * Todos los textos llegan de stationPage.wiring (i18n es/en): cero
 * texto hardcodeado.
 */

type SensorId = 'dht22' | 'dht11' | 'b3950' | 'bme280';

interface PinOption {
  gpio: number;
  /** Posición Y sobre el header del ESP32 en el SVG. */
  y: number;
}

const DIGITAL_PINS: PinOption[] = [
  { gpio: 4, y: 236 },
  { gpio: 15, y: 262 },
  { gpio: 16, y: 210 }
];

const ADC_PINS: PinOption[] = [
  { gpio: 34, y: 158 },
  { gpio: 35, y: 184 },
  { gpio: 32, y: 210 }
];

const SENSORS: SensorId[] = ['dht22', 'dht11', 'b3950', 'bme280'];

export function WiringDiagram() {
  const t = useTranslations('stationPage.wiring');
  const prefersReducedMotion = useReducedMotion();

  const [sensor, setSensor] = useState<SensorId>('dht22');
  const [digitalPin, setDigitalPin] = useState(4);
  const [adcPin, setAdcPin] = useState(34);
  const [showPullUp, setShowPullUp] = useState(true);

  const activeDigital =
    DIGITAL_PINS.find((p) => p.gpio === digitalPin) ?? DIGITAL_PINS[0];
  const activeAdc = ADC_PINS.find((p) => p.gpio === adcPin) ?? ADC_PINS[0];

  /** Cable de señal (cyan): sensor → pin elegido del ESP32. */
  const signalWirePath = useMemo(() => {
    if (sensor === 'b3950') {
      const targetY = activeAdc.y;
      return `M 475 184 C 380 184, 370 ${targetY}, 156 ${targetY}`;
    }
    if (sensor === 'bme280') {
      // SDA → GPIO 21 (y=132 del header derecho).
      return 'M 480 170 C 400 170, 390 132, 316 132';
    }
    const targetY = activeDigital.y;
    return `M 480 170 C 400 170, 390 ${targetY}, 316 ${targetY}`;
  }, [sensor, activeDigital, activeAdc]);

  // SCL → GPIO 22 (solo BME280).
  const sclWirePath = 'M 480 198 C 415 198, 395 158, 316 158';

  const isDigital = sensor === 'dht22' || sensor === 'dht11';

  return (
    <div className="space-y-5">
      {/* Selector de sensor */}
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-300">
          {t('sensorPicker')}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SENSORS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSensor(id)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                sensor === id
                  ? 'border-cyan-400/60 bg-cyan-500/20 text-white'
                  : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {t(`sensors.${id}.short`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Lienzo SVG del cableado animado */}
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#050811] p-4 lg:col-span-8">
          <svg
            viewBox="0 0 740 370"
            className="block h-auto w-full select-none"
            role="img"
            aria-label={t('diagramAria', { sensor: t(`sensors.${sensor}.short`) })}
          >
            <defs>
              <pattern
                id="pcb-grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="0.5"
                  strokeOpacity="0.45"
                />
              </pattern>
            </defs>

            <rect width="740" height="370" rx="10" fill="#050811" />
            <rect width="740" height="370" rx="10" fill="url(#pcb-grid)" />

            {/* Placa ESP32 DevKit v1 */}
            <g>
              <rect
                x="130"
                y="42"
                width="210"
                height="285"
                rx="10"
                fill="#0F172A"
                stroke="#334155"
                strokeWidth="2"
              />
              {/* Escudo metálico WROOM-32 */}
              <rect
                x="175"
                y="56"
                width="120"
                height="88"
                rx="4"
                fill="#1E293B"
                stroke="#475569"
                strokeWidth="1.5"
              />
              <text
                x="235"
                y="95"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                className="fill-slate-200 font-mono"
              >
                ESP-WROOM-32
              </text>
              <text
                x="235"
                y="114"
                textAnchor="middle"
                fontSize="10"
                className="fill-cyan-400 font-mono"
              >
                Wi-Fi + BLE · 3.3V
              </text>

              {/* Puerto USB */}
              <rect
                x="208"
                y="305"
                width="54"
                height="28"
                rx="4"
                fill="#334155"
                stroke="#64748B"
                strokeWidth="1.5"
              />
              <text
                x="235"
                y="323"
                textAnchor="middle"
                fontSize="9.5"
                className="fill-slate-200 font-mono"
              >
                USB
              </text>

              {/* Botones EN y BOOT */}
              <rect x="165" y="294" width="22" height="14" rx="2" fill="#1E293B" stroke="#475569" />
              <text x="176" y="288" textAnchor="middle" fontSize="8.5" className="fill-slate-400 font-mono">EN</text>
              <rect x="283" y="294" width="22" height="14" rx="2" fill="#1E293B" stroke="#475569" />
              <text x="294" y="288" textAnchor="middle" fontSize="8.5" className="fill-slate-400 font-mono">BOOT</text>
              {/* Header de pines IZQUIERDO */}
              {[
                { label: '3V3', y: 106, color: '#EF4444' },
                { label: 'GND', y: 132, color: '#64748B' },
                { label: 'G34', y: 158, color: sensor === 'b3950' && adcPin === 34 ? '#22D3EE' : '#475569' },
                { label: 'G35', y: 184, color: sensor === 'b3950' && adcPin === 35 ? '#22D3EE' : '#475569' },
                { label: 'G32', y: 210, color: sensor === 'b3950' && adcPin === 32 ? '#22D3EE' : '#475569' },
                { label: 'G33', y: 236, color: '#475569' },
                { label: 'G25', y: 262, color: '#475569' }
              ].map((pin) => (
                <g key={pin.label}>
                  <circle cx="152" cy={pin.y} r="5.5" fill="#050811" stroke={pin.color} strokeWidth="2" />
                  <text x="164" y={pin.y + 3.5} fontSize="10" className="fill-slate-300 font-mono">
                    {pin.label}
                  </text>
                </g>
              ))}

              {/* Header de pines DERECHO */}
              {[
                { label: 'GND', y: 106, color: '#64748B' },
                { label: 'G21 SDA', y: 132, color: sensor === 'bme280' ? '#22D3EE' : '#475569' },
                { label: 'G22 SCL', y: 158, color: sensor === 'bme280' ? '#A78BFA' : '#475569' },
                { label: 'G17', y: 184, color: '#475569' },
                { label: 'G16', y: 210, color: isDigital && digitalPin === 16 ? '#22D3EE' : '#475569' },
                { label: 'G4', y: 236, color: isDigital && digitalPin === 4 ? '#22D3EE' : '#475569' },
                { label: 'G15', y: 262, color: isDigital && digitalPin === 15 ? '#22D3EE' : '#475569' }
              ].map((pin) => (
                <g key={pin.label}>
                  <circle cx="318" cy={pin.y} r="5.5" fill="#050811" stroke={pin.color} strokeWidth="2" />
                  <text x="307" y={pin.y + 3.5} textAnchor="end" fontSize="10" className="fill-slate-300 font-mono">
                    {pin.label}
                  </text>
                </g>
              ))}
            </g>

            {/* Cable de ALIMENTACIÓN 3.3V (rojo) */}
            {sensor === 'b3950' ? (
              <path
                d="M 148 106 C 85 106, 85 28, 390 28 C 510 28, 520 112, 520 128"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
              />
            ) : (
              <path
                d="M 148 106 C 85 106, 85 28, 390 28 C 445 28, 445 142, 480 142"
                fill="none"
                stroke="#EF4444"
                strokeWidth="2.5"
              />
            )}

            {/* Cable de TIERRA GND (slate) */}
            {sensor === 'b3950' ? (
              <path
                d="M 322 106 C 405 106, 405 268, 520 268 L 520 245"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="2.5"
              />
            ) : (
              <path
                d="M 322 106 C 415 106, 415 245, 465 245 L 480 226"
                fill="none"
                stroke="#94A3B8"
                strokeWidth="2.5"
              />
            )}

            {/* Resistencia pull-up 10 kΩ (DHT suelto, opcional) */}
            {isDigital && showPullUp && (
              <g>
                <line x1="455" y1="142" x2="455" y2="152" stroke="#F59E0B" strokeWidth="1.5" />
                <rect x="449" y="152" width="12" height="10" rx="2" fill="#F59E0B" />
                <line x1="455" y1="162" x2="455" y2="170" stroke="#F59E0B" strokeWidth="1.5" />
                <text x="455" y="134" textAnchor="middle" fontSize="9" className="fill-amber-300 font-mono">
                  10 kΩ
                </text>
              </g>
            )}

            {/* Cable de SEÑAL animado (DATA / ADC / SDA) */}
            <path d={signalWirePath} fill="none" stroke="#0891B2" strokeWidth="3" strokeOpacity="0.4" />
            <motion.path
              d={signalWirePath}
              fill="none"
              stroke="#22D3EE"
              strokeWidth="2.5"
              strokeDasharray="8 10"
              animate={prefersReducedMotion ? undefined : { strokeDashoffset: [36, 0] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
            />

            {/* Cable SCL secundario (solo BME280) */}
            {sensor === 'bme280' && (
              <>
                <path d={sclWirePath} fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeOpacity="0.45" />
                <motion.path
                  d={sclWirePath}
                  fill="none"
                  stroke="#A78BFA"
                  strokeWidth="2"
                  strokeDasharray="6 10"
                  animate={prefersReducedMotion ? undefined : { strokeDashoffset: [32, 0] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                />
              </>
            )}
            {/* DIBUJO DEL SENSOR */}
            {sensor === 'b3950' ? (
              <g>
                {/* Divisor de tensión + NTC */}
                <rect x="475" y="112" width="195" height="155" rx="10" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
                <text x="572" y="133" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-white font-mono">
                  {t('dividerTitle')}
                </text>
                {/* Resistencia fija 10 k */}
                <line x1="520" y1="128" x2="520" y2="146" stroke="#EF4444" strokeWidth="2" />
                <rect x="510" y="146" width="20" height="24" rx="3" fill="#D97706" stroke="#FBBF24" />
                <text x="540" y="162" fontSize="10" className="fill-amber-300 font-mono">R = 10 kΩ</text>
                <line x1="520" y1="170" x2="520" y2="184" stroke="#22D3EE" strokeWidth="2" />
                {/* Nodo central → ADC */}
                <circle cx="520" cy="184" r="4.5" fill="#22D3EE" />
                <line x1="475" y1="184" x2="520" y2="184" stroke="#22D3EE" strokeWidth="2" />
                {/* Termistor NTC */}
                <line x1="520" y1="184" x2="520" y2="200" stroke="#94A3B8" strokeWidth="2" />
                <circle cx="520" cy="216" r="13" fill="#1E293B" stroke="#38BDF8" strokeWidth="2" />
                <text x="520" y="220" textAnchor="middle" fontSize="9.5" fontWeight="700" className="fill-cyan-300 font-mono">NTC</text>
                <text x="544" y="220" fontSize="10" className="fill-slate-300 font-mono">B3950 10 kΩ</text>
                <line x1="520" y1="229" x2="520" y2="245" stroke="#94A3B8" strokeWidth="2" />
              </g>
            ) : (
              <g>
                {/* Carcasa del sensor */}
                <rect
                  x="485"
                  y="112"
                  width="175"
                  height="142"
                  rx="10"
                  fill={
                    sensor === 'dht22'
                      ? '#E2E8F0'
                      : sensor === 'dht11'
                        ? '#0284C7'
                        : '#312E81'
                  }
                  stroke="#475569"
                  strokeWidth="2"
                />
                {/* Rejilla de ventilación DHT */}
                {(isDigital) && (
                  <g opacity="0.35">
                    {[0, 1, 2, 3].map((row) =>
                      [0, 1, 2, 3, 4].map((col) => (
                        <rect
                          key={`${row}-${col}`}
                          x={515 + col * 24}
                          y={132 + row * 18}
                          width="16"
                          height="10"
                          rx="2"
                          fill="#0F172A"
                        />
                      ))
                    )}
                  </g>
                )}
                <text
                  x="572"
                  y="234"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="800"
                  className={`font-mono ${sensor === 'dht22' ? 'fill-slate-900' : 'fill-white'}`}
                >
                  {t(`sensors.${sensor}.short`)}
                </text>

                {/* Pines del sensor (borde izquierdo) */}
                <circle cx="485" cy="142" r="5" fill="#EF4444" stroke="#050811" strokeWidth="1.5" />
                <text x="496" y="145" fontSize="9.5" fontWeight="700" className={`font-mono ${sensor === 'dht22' ? 'fill-slate-900' : 'fill-white'}`}>VCC</text>

                <circle cx="485" cy="170" r="5" fill="#22D3EE" stroke="#050811" strokeWidth="1.5" />
                <text x="496" y="173" fontSize="9.5" fontWeight="700" className={`font-mono ${sensor === 'dht22' ? 'fill-slate-900' : 'fill-white'}`}>
                  {sensor === 'bme280' ? 'SDA' : 'DATA'}
                </text>

                {sensor === 'bme280' && (
                  <>
                    <circle cx="485" cy="198" r="5" fill="#A78BFA" stroke="#050811" strokeWidth="1.5" />
                    <text x="496" y="201" fontSize="9.5" fontWeight="700" className="fill-white font-mono">SCL</text>
                  </>
                )}

                <circle cx="485" cy="226" r="5" fill="#94A3B8" stroke="#050811" strokeWidth="1.5" />
                <text x="496" y="229" fontSize="9.5" fontWeight="700" className={`font-mono ${sensor === 'dht22' ? 'fill-slate-900' : 'fill-white'}`}>GND</text>
              </g>
            )}

            {/* Leyenda */}
            <g transform="translate(20, 342)" fontSize="10" className="fill-slate-300 font-mono">
              <circle cx="8" cy="0" r="4" fill="#EF4444" />
              <text x="18" y="3.5">{t('legendVcc')}</text>
              <circle cx="165" cy="0" r="4" fill="#94A3B8" />
              <text x="175" y="3.5">{t('legendGnd')}</text>
              <circle cx="285" cy="0" r="4" fill="#22D3EE" />
              <text x="295" y="3.5">{t('legendSignal')}</text>
            </g>
          </svg>
        </div>
        {/* Guía del sensor + selector de pin ligado al diagrama */}
        <div className="space-y-4 lg:col-span-4">
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-white">
                {t(`sensors.${sensor}.name`)}
              </span>
              <span className="font-mono text-xs text-cyan-300">
                {t(`sensors.${sensor}.precision`)}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {t(`sensors.${sensor}.pins`)}
            </p>

            {/* Selector de pin conectado en el diagrama */}
            {sensor === 'b3950' ? (
              <div>
                <label htmlFor="wiring-adc-pin" className="mb-1.5 block text-xs font-semibold text-slate-200">
                  {t('adcPinLabel')}
                </label>
                <select
                  id="wiring-adc-pin"
                  value={adcPin}
                  onChange={(e) => setAdcPin(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white"
                >
                  {ADC_PINS.map((p) => (
                    <option key={p.gpio} value={p.gpio}>
                      GPIO {p.gpio} (ADC1)
                    </option>
                  ))}
                </select>
              </div>
            ) : sensor !== 'bme280' ? (
              <div className="space-y-2">
                <label htmlFor="wiring-data-pin" className="block text-xs font-semibold text-slate-200">
                  {t('digitalPinLabel')}
                </label>
                <select
                  id="wiring-data-pin"
                  value={digitalPin}
                  onChange={(e) => setDigitalPin(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white"
                >
                  {DIGITAL_PINS.map((p) => (
                    <option key={p.gpio} value={p.gpio}>
                      {p.gpio === 4 ? `GPIO ${p.gpio} · ${t('recommended')}` : `GPIO ${p.gpio}`}
                    </option>
                  ))}
                </select>
                <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={showPullUp}
                    onChange={(e) => setShowPullUp(e.target.checked)}
                    className="accent-amber-400"
                  />
                  {t('pullUpLabel')}
                </label>
              </div>
            ) : (
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2.5 font-mono text-xs text-cyan-300">
                {t('i2cFixed')}
              </div>
            )}

            <ol className="list-inside list-decimal space-y-2 border-t border-slate-800 pt-2 text-xs leading-relaxed text-slate-300">
              <li>{t(`sensors.${sensor}.step1`)}</li>
              <li>{t(`sensors.${sensor}.step2`)}</li>
              <li>{t(`sensors.${sensor}.step3`)}</li>
            </ol>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <div>
              <span className="font-bold">{t('cautionTitle')}: </span>
              {t(`sensors.${sensor}.caution`)} {t('cautionShade')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
