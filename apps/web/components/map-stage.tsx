'use client';

import { useMemo, useRef, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform
} from 'motion/react';
import { ArrowDown, ChevronDown, Radio, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useRouter } from '@/i18n/navigation';
import type { MapCity } from '@/components/world-map';
import { VARIABLE_ICONS } from '@/components/variable-icons';
import { VARIABLE_CONFIG, VARIABLE_IDS } from '@/lib/analysis/variables';
import type { SeasonOrAnnual, VariableId } from '@orbitstreet/shared-types';

/**
 * El globo renderiza ~240 países en SVG: se carga solo en el cliente
 * (como el prototipo de referencia) para mantener el HTML liviano.
 */
const WorldMap = dynamic(
  () => import('@/components/world-map').then((mod) => mod.WorldMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#050811]" />
  }
);

/**
 * Escenario a pantalla completa: globo 3D interactivo + paneles flotantes
 * translúcidos (ficha de misión a la izquierda, selector de variables a la
 * derecha) que se desvanecen con el scroll, como el prototipo de referencia.
 */

const CITY_IDS = [
  'asuncion',
  'chaco',
  'buenos_aires',
  'lima',
  'ciudad_de_mexico',
  'madrid',
  'nueva_york'
] as const;

const CITY_COORDS: Record<(typeof CITY_IDS)[number], { lat: number; lon: number }> = {
  asuncion: { lat: -25.2639, lon: -57.5333 },
  chaco: { lat: -22.0, lon: -60.5 },
  buenos_aires: { lat: -34.6037, lon: -58.3816 },
  lima: { lat: -12.0464, lon: -77.0428 },
  ciudad_de_mexico: { lat: 19.4326, lon: -99.1332 },
  madrid: { lat: 40.4168, lon: -3.7038 },
  nueva_york: { lat: 40.7128, lon: -74.006 }
};

const SEASONS: SeasonOrAnnual[] = ['ALL', 'DJF', 'MAM', 'JJA', 'SON'];
const START_YEARS = [1981, 1990, 2001] as const;
const END_YEARS = [2010, 2020, 2025] as const;

/** Punto seleccionado en el globo (presetId opcional: clic libre no trae preset). */
interface SelectedLocation {
  lat: number;
  lon: number;
  name: string;
  country: string;
  presetId?: string;
}

export function MapStage() {
  const t = useTranslations('home.map');
  const th = useTranslations('home');
  const td = useTranslations('detective');
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [focusKey, setFocusKey] = useState(0);
  const [selected, setSelected] = useState<SelectedLocation>({
    lat: CITY_COORDS.asuncion.lat,
    lon: CITY_COORDS.asuncion.lon,
    name: 'Asunción',
    country: 'Paraguay',
    presetId: 'asuncion'
  });
  const [variable, setVariable] = useState<VariableId>('T2M_MAX');
  const [season, setSeason] = useState<SeasonOrAnnual>('SON');
  const [startYear, setStartYear] = useState(1981);
  const [endYear, setEndYear] = useState(2025);

  // Ciudades con nombres localizados por i18n (los pines llevan texto visible).
  const cities: MapCity[] = useMemo(
    () =>
      CITY_IDS.map((id) => ({
        id,
        name: t(`cities.${id}.name`),
        country: t(`cities.${id}.country`),
        lat: CITY_COORDS[id].lat,
        lon: CITY_COORDS[id].lon,
        isFlagship: id === 'asuncion'
      })),
    [t]
  );

  // Desvanecer y encoger el mapa al hacer scroll (como el prototipo).
  const { scrollYProgress } = useScroll({
    target: stageRef,
    offset: ['start start', 'end start']
  });
  const mapOpacity = useTransform(scrollYProgress, [0.15, 0.85], [1, 0]);
  const mapScale = useTransform(
    scrollYProgress,
    [0.15, 0.85],
    prefersReducedMotion ? [1, 1] : [1, 0.93]
  );
  const hudOpacity = useTransform(scrollYProgress, [0.05, 0.55], [1, 0]);
  const hudTranslateY = useTransform(
    scrollYProgress,
    [0.05, 0.55],
    prefersReducedMotion ? [0, 0] : [0, -28]
  );

  const handleSelectLocation = (loc: {
    lat: number;
    lon: number;
    name: string;
    country: string;
    presetId?: string;
  }) => {
    setSelected(loc);
  };

  /** URL del Modo Detective con todo el estado del escenario. */
  const detectiveUrl = () => {
    const params = new URLSearchParams({
      variable,
      season,
      start: `${startYear}-01-01`,
      end: `${endYear}-12-31`
    });
    if (selected.presetId) {
      params.set('preset', selected.presetId);
    } else {
      params.set('preset', 'custom');
      params.set('lat', String(selected.lat));
      params.set('lon', String(selected.lon));
    }
    return `/detective?${params.toString()}`;
  };

  return (
    <div ref={stageRef} className="relative h-[135vh] w-full">
      {/* Pantalla completa fija mientras dura el hero */}
      <div className="sticky top-14 h-[calc(100vh-3.5rem)] w-full overflow-hidden">
        <motion.div
          style={{ opacity: mapOpacity, scale: mapScale }}
          className="absolute inset-0 origin-center"
        >
          <WorldMap
            cities={cities}
            selectedLat={selected.lat}
            selectedLon={selected.lon}
            selectedName={selected.name}
            selectedCountry={selected.country}
            focusKey={focusKey}
            onSelectLocation={handleSelectLocation}
          />
        </motion.div>

        {/* Capa HUD: paneles flotantes translúcidos */}
        <motion.div
          style={{ opacity: hudOpacity, y: hudTranslateY }}
          className="pointer-events-none absolute inset-0 z-20"
        >
          {/* Panel izquierdo: ficha de misión del detective */}
          <div className="pointer-events-auto absolute left-6 top-32 hidden w-[400px] max-h-[calc(100vh-18rem)] overflow-y-auto md:block">
            <div className="space-y-3 rounded-2xl border border-white/15 bg-slate-950/70 p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="text-cyan-300">Ground Truth Detective</span>
                <span className="text-amber-300">{t('dataBadge')}</span>
              </div>
              <h1 className="text-balance text-xl font-bold leading-snug tracking-tight text-white">
                {t('headline')}
              </h1>
              <p className="text-xs leading-relaxed text-slate-300">
                {t('description')}
              </p>

              {/* Chips de ciudades predefinidas */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {cities.map((city) => {
                  const active =
                    Math.abs(selected.lat - city.lat) < 0.01 &&
                    Math.abs(selected.lon - city.lon) < 0.01;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => {
                        setSelected({
                          lat: city.lat,
                          lon: city.lon,
                          name: city.name,
                          country: city.country,
                          presetId: city.id
                        });
                        setFocusKey((key) => key + 1);
                      }}
                      className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        active
                          ? 'border-cyan-400/60 bg-cyan-500/25 text-cyan-100'
                          : 'border-white/10 bg-white/[0.05] text-slate-300 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {city.name}
                      {city.isFlagship ? ' · ★' : ''}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => router.push(detectiveUrl())}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-white/[0.12]"
              >
                <Search className="h-3.5 w-3.5" />
                {t('investigate')}
              </button>

              {/* Franja de datos clave */}
              <div className="grid grid-cols-3 gap-1.5 border-t border-white/10 pt-2.5">
                {(['statYears', 'statTests', 'statCI'] as const).map((key) => (
                  <span
                    key={key}
                    className="font-mono text-[10px] leading-snug text-cyan-300/90"
                  >
                    {th(`hero.${key}`)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Panel derecho: variables y periodo */}
          <div className="pointer-events-auto absolute right-4 top-20 w-[calc(100%-2rem)] max-h-[calc(100vh-12rem)] overflow-y-auto sm:right-6 sm:w-[360px]">
            <div className="flex flex-col gap-3.5 rounded-2xl border border-white/15 bg-slate-950/75 p-4 text-slate-100 shadow-2xl backdrop-blur-md sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {t('variablesTitle')}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {t('variablesSubtitle')}
                  </p>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-cyan-300">
                  {VARIABLE_CONFIG[variable].powerParameters[0]}
                </span>
              </div>

              {/* Grilla de variables */}
              <div className="grid grid-cols-2 gap-2">
                {VARIABLE_IDS.map((id) => {
                  const Icon = VARIABLE_ICONS[id];
                  const active = id === variable;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setVariable(id)}
                      className={`flex flex-col gap-1 rounded-xl border p-2.5 text-left transition-colors ${
                        active
                          ? 'border-cyan-400/60 bg-cyan-500/20 text-white'
                          : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08]'
                      }`}
                    >
                      <span
                        className={`flex items-center gap-1.5 truncate text-xs font-semibold ${
                          active ? 'text-cyan-200' : 'text-slate-100'
                        }`}
                      >
                        <span className={active ? 'text-cyan-300' : 'text-slate-400'}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        {td(`variables.${id}.label`)}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {VARIABLE_CONFIG[id].unit}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Estaciones */}
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                  {t('seasonLabel')}
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {SEASONS.map((seasonId) => (
                    <button
                      key={seasonId}
                      type="button"
                      onClick={() => setSeason(seasonId)}
                      className={`rounded-lg border px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                        season === seasonId
                          ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                      }`}
                    >
                      {seasonId === 'ALL' ? t('allSeasons') : seasonId}
                    </button>
                  ))}
                </div>
              </div>

              {/* Años */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="map-start-year"
                    className="mb-1 block text-[11px] font-medium text-slate-400"
                  >
                    {t('startYear')}
                  </label>
                  <select
                    id="map-start-year"
                    value={startYear}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setStartYear(value);
                      if (value >= endYear) setEndYear(2025);
                    }}
                    className="w-full rounded-lg border border-white/15 bg-slate-900/90 px-2.5 py-1.5 font-mono text-xs tabular-nums text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    {START_YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="map-end-year"
                    className="mb-1 block text-[11px] font-medium text-slate-400"
                  >
                    {t('endYear')}
                  </label>
                  <select
                    id="map-end-year"
                    value={endYear}
                    onChange={(event) => setEndYear(Number(event.target.value))}
                    className="w-full rounded-lg border border-white/15 bg-slate-900/90 px-2.5 py-1.5 font-mono text-xs tabular-nums text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    {END_YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Acciones */}
              <div className="space-y-2 border-t border-white/10 pt-1">
                <button
                  type="button"
                  onClick={() => router.push(detectiveUrl())}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-500"
                >
                  <Radio className="h-3.5 w-3.5" />
                  {t('consult')}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById('questions')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15"
                >
                  <span>{t('seeAnalysis')}</span>
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>

                <p className="text-[11px] leading-snug text-slate-400">
                  {t('previewNote')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Indicador de scroll */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-slate-400">
          <span className="text-[11px]">{t('scrollCue')}</span>
          <ChevronDown className="h-4 w-4 animate-bounce text-cyan-400" aria-hidden />
        </div>
      </div>
    </div>
  );
}