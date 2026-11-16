'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Loader2, Usb, Wifi } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Pasos interactivos para encender y conectarse al nodo ESP32 (portado
 * del diseño de referencia "Calle vs. Cielo", sección 02):
 * stepper de tarjetas + panel de detalle por paso, con un selector de
 * redes Wi-Fi que es MAQUETA INTERACTIVA (etiquetada: nunca simular
 * sin etiqueta). Los pasos siguen el flujo REAL del firmware:
 *
 *   1. Alimenta el nodo por USB          4. Completa el asistente
 *   2. Únete a «OrbitStreet-Setup»          (WiFi + sensor + token)
 *   3. Abre http://192.168.4.1           5. Nodo en línea
 */

type StepId = 1 | 2 | 3 | 4 | 5;

const STEPS: StepId[] = [1, 2, 3, 4, 5];

// Maqueta de redes Wi-Fi (solo didáctica; la del ESP32 va resaltada).
const SIM_WIFI_NETWORKS = [
  { ssid: 'OrbitStreet-Setup', isEsp: true, desc: 'Red del nodo · sin contraseña' },
  { ssid: 'Familia_2G', isEsp: false, desc: 'Seguridad WPA2' },
  { ssid: 'Vecino_WiFi', isEsp: false, desc: 'Seguridad WPA2' }
] as const;

export function ConnectSteps() {
  const t = useTranslations('stationPage.connect');

  const [step, setStep] = useState<StepId>(1);
  // Maqueta del picker: 'idle' | 'connecting' | 'connected'.
  const [wifiState, setWifiState] = useState<'idle' | 'connecting' | 'connected'>('idle');

  const stepCardClass = (id: StepId) =>
    `text-left p-3.5 rounded-xl border transition-colors ${
      step === id
        ? 'border-cyan-400/60 bg-cyan-500/15 text-white'
        : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700'
    }`;

  const connectSimWifi = () => {
    if (wifiState !== 'idle') return;
    setWifiState('connecting');
    window.setTimeout(() => setWifiState('connected'), 1400);
  };

  return (
    <div className="space-y-6">
      {/* Stepper: tarjetas seleccionables */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setStep(id)}
            className={stepCardClass(id)}
          >
            <div className="text-xs font-bold">{t(`steps.${id}.title`)}</div>
            <div className="mt-0.5 text-[11px] text-slate-400">
              {t(`steps.${id}.short`)}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Panel de detalle del paso */}
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-5 lg:col-span-7">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <h3 className="text-base font-bold text-white">
              {t(`steps.${step}.heading`)}
            </h3>
            <p className="text-xs leading-relaxed text-slate-300">
              {t(`steps.${step}.body`)}
            </p>
            {/* Contenido extra por paso */}
            {step === 1 && (
              <p className="flex items-start gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-[11px] leading-snug text-cyan-200">
                <Usb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {t('steps.1.tip')}
              </p>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <span className="inline-block rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1 font-mono text-[11px] text-amber-300">
                  {t('simBadge')}
                </span>
                {/* Maqueta del selector de redes Wi-Fi del teléfono/PC */}
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#050811]">
                  <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-3.5 py-2 font-mono text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <Wifi className="h-3.5 w-3.5 text-cyan-400" aria-hidden />
                      {t('wifiPicker')}
                    </span>
                    <span>{t('wifiApActive')}</span>
                  </div>
                  <div className="divide-y divide-slate-800/80">
                    {SIM_WIFI_NETWORKS.map((net) => {
                      const isTarget = net.isEsp;
                      const connected = isTarget && wifiState === 'connected';
                      const connecting = isTarget && wifiState === 'connecting';
                      return (
                        <button
                          key={net.ssid}
                          type="button"
                          onClick={isTarget ? connectSimWifi : undefined}
                          className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${
                            connected
                              ? 'bg-emerald-500/15'
                              : isTarget
                                ? 'hover:bg-cyan-500/10'
                                : 'cursor-default opacity-70'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`truncate font-mono text-xs font-bold ${
                                  isTarget ? 'text-cyan-300' : 'text-slate-200'
                                }`}
                              >
                                {net.ssid}
                              </span>
                              {isTarget && (
                                <span className="font-mono text-[10px] text-amber-300">
                                  [ESP32]
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[11px] text-slate-400">
                              {connected
                                ? t('wifiConnected')
                                : connecting
                                  ? t('wifiConnecting')
                                  : net.desc}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
                            {connecting ? (
                              <Loader2
                                className="h-3.5 w-3.5 animate-spin text-cyan-400"
                                aria-hidden
                              />
                            ) : connected ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                                <Check className="h-3.5 w-3.5" aria-hidden />
                                {t('wifiOk')}
                              </span>
                            ) : (
                              isTarget && (
                                <span className="text-cyan-300 hover:underline">
                                  {t('wifiConnect')}
                                </span>
                              )
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {wifiState === 'connected' && (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400"
                  >
                    {t('wifiNext')} →
                  </button>
                )}
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {t('steps.2.tip')}
                </p>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-3">
                {/* Barra de URL estilo navegador (maqueta visual) */}
                <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-4 py-2.5 font-mono text-xs text-slate-200">
                  <span aria-hidden className="text-emerald-400">🔒</span>
                  <span className="truncate">http://192.168.4.1</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {t('steps.3.tip')}
                </p>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-400"
                >
                  {t('steps.3.next')} →
                </button>
              </div>
            )}

            {step === 4 && (
              <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-slate-300">
                <li>{t('steps.4.f1')}</li>
                <li>{t('steps.4.f2')}</li>
                <li>{t('steps.4.f3')}</li>
                <li>{t('steps.4.f4')}</li>
                <li>{t('steps.4.f5')}</li>
              </ul>
            )}

            {step === 5 && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-200">
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t('steps.5.done')}
                </p>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  {t('steps.5.tip')}
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Flujo lateral: USB → ESP32 → WiFi → navegador (visual) */}
        <div className="rounded-xl border border-slate-800 bg-[#050811] p-5 lg:col-span-5">
          <div className="space-y-4 text-center">
            {/* PC */}
            <div className="rounded-lg border border-slate-700 bg-slate-950 p-3">
              <Usb className="mx-auto h-6 w-6 text-cyan-300" aria-hidden />
              <p className="mt-1 font-mono text-[11px] text-slate-300">
                {t('flow.pc')}
              </p>
            </div>
            <div aria-hidden className="text-cyan-500">↓</div>
            {/* ESP32 */}
            <div
              className={`rounded-lg border p-3 transition-colors ${
                step >= 2
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-slate-700 bg-slate-950'
              }`}
            >
              <Wifi className="mx-auto h-6 w-6 text-emerald-300" aria-hidden />
              <p className="mt-1 font-mono text-[11px] text-slate-300">
                OrbitStreet-Setup
              </p>
            </div>
            <div aria-hidden className="text-cyan-500">↓</div>
            {/* Navegador */}
            <div
              className={`rounded-lg border p-3 transition-colors ${
                step >= 3
                  ? 'border-cyan-400/50 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-950'
              }`}
            >
              <p className="font-mono text-[11px] text-cyan-300">
                http://192.168.4.1
              </p>
              <p className="mt-1 font-mono text-[11px] text-slate-300">
                {t('flow.dashboard')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}