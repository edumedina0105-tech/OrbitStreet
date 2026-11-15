'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform
} from 'motion/react';
import { ArrowDown, ChevronDown, FileText, FolderArchive, GitCompareArrows, Loader2, MapPin, Radio, Search, Upload, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import type { MapCity } from '@/components/world-map';
import { ObservationModal } from '@/components/observation-modal';
import { CaseModal } from '@/components/case-modal';
import { TrendChart, type TrendChartDatum } from '@/components/trend-chart';
import { DetectiveReport } from '@/components/detective-report';
import { VARIABLE_ICONS } from '@/components/variable-icons';
import {
  analyzeDailySeries,
  senFit,
  type SeriesAnalysis
} from '@/lib/analysis/analyze-series';
import { benjaminiHochberg } from '@/lib/stats/fdr';
import { VARIABLE_CONFIG, VARIABLE_IDS } from '@/lib/analysis/variables';
import { YEARS_NEEDED_PRACTICAL_LIMIT } from '@orbitstreet/shared-types';
import type {
  SeasonOrAnnual,
  TimePoint,
  VariableId
} from '@orbitstreet/shared-types';

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
/** Todos los años disponibles en NASA POWER: 1981..2025, uno por opción. */
const YEAR_OPTIONS = Array.from(
  { length: 2025 - 1981 + 1 },
  (_, i) => 1981 + i
);

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
  const tc = useTranslations('comparator');
  const locale = useLocale();
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

  // Análisis en línea (mismo motor determinista que el Modo Detective).
  const [analysis, setAnalysis] = useState<SeriesAnalysis | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Panel grande de resultados (izquierda) + corrimiento animado del mapa:
  // se abre al consultar y se cierra al tocar el mapa (que se re-centra).
  const [resultsOpen, setResultsOpen] = useState(false);

  // Acordeones móviles: en pantallas pequeñas los paneles del HUD se
  // PLEGAN para que el globo respire; un tap los despliega. En escritorio
  // (sm/md en adelante) todo queda como siempre (paneles fijos expandidos).
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [mobileMissionOpen, setMobileMissionOpen] = useState(false);

  // Datos comunitarios públicos: cercanos a la celda seleccionada y
  // pines globales para el globo (ciencia ciudadana visible).
  const [communityNearby, setCommunityNearby] = useState<
    Array<{
      username: string;
      variable: string;
      value: number;
      unit: string;
      observedAt: string;
      verdict: string;
      bias: number | null;
    }>
  >([]);
  const [communityPins, setCommunityPins] = useState<
    Array<{
      lat: number;
      lon: number;
      username: string;
      variable: string;
      value: number;
      unit: string;
    }>
  >([]);
  const [showPins, setShowPins] = useState(false);
  const [communityBusy, setCommunityBusy] = useState(false);

  const fetchCommunityNearby = useCallback(
    async (lat: number, lon: number) => {
      try {
        const response = await fetch(
          `/api/observations/public?lat=${lat}&lon=${lon}`
        );
        const data = (await response.json()) as {
          nearby?: Array<{
            username: string;
            variable: string;
            value: number;
            unit: string;
            observedAt: string;
            verdict: string;
            bias: number | null;
          }>;
        };
        setCommunityNearby(data.nearby ?? []);
      } catch {
        setCommunityNearby([]);
      }
    },
    []
  );

  const togglePins = async () => {
    if (showPins) {
      setShowPins(false);
      return;
    }
    setCommunityBusy(true);
    try {
      const response = await fetch('/api/observations/public');
      const data = (await response.json()) as {
        recent?: Array<{
          latitude: number;
          longitude: number;
          username: string;
          variable: string;
          value: number;
          unit: string;
        }>;
      };
      setCommunityPins(
        (data.recent ?? []).map((obs) => ({
          lat: obs.latitude,
          lon: obs.longitude,
          username: obs.username,
          variable: obs.variable,
          value: obs.value,
          unit: obs.unit
        }))
      );
      setShowPins(true);
      // Volar hacia el dato más reciente: garantiza que los pines
      // queden en el hemisferio visible del globo.
      const first = (data.recent ?? [])[0];
      if (first) {
        setSelected({
          lat: first.latitude,
          lon: first.longitude,
          name: t('community.pinName'),
          country: ''
        });
        setFocusKey((key) => key + 1);
      }
    } catch {
      setCommunityPins([]);
    } finally {
      setCommunityBusy(false);
    }
  };

  // Al cambiar el punto seleccionado, consultar la comunidad de esa celda.
  useEffect(() => {
    void fetchCommunityNearby(selected.lat, selected.lon);
  }, [selected.lat, selected.lon, fetchCommunityNearby]);

  // ¿Hay IA (Gemini) configurada? Lo responde /api/auth/me (flag público);
  // el informe de la sección de resultados lo necesita.
  const [aiAvailable, setAiAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = (await response.json()) as { aiAvailable: boolean };
        if (!cancelled) setAiAvailable(Boolean(data.aiAvailable));
      } catch {
        if (!cancelled) setAiAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Informe narrado por IA para el lugar analizado (aparece en el panel
  // izquierdo; la IA solo redacta, las cifras ya están calculadas).
  const [aiReport, setAiReport] = useState<{
    text: string;
    engine: 'gemini' | 'template';
    fallback: boolean;
  } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  // Modal "Sube tu dato" (observación comunitaria con evidencia).
  const [uploadOpen, setUploadOpen] = useState(false);

  // Modal "Archivar como caso" (Tablón de Casos del Detective).
  const [caseOpen, setCaseOpen] = useState(false);

  // Comparador de regiones DENTRO del mapa: se eligen dos puntos con
  // clics sobre el globo y el resultado flota sobre el mapa.
  const [compareMode, setCompareMode] = useState<
    'off' | 'pickA' | 'pickB' | 'done'
  >('off');
  const [comparePointA, setComparePointA] = useState<{
    lat: number;
    lon: number;
    name: string;
  } | null>(null);
  const [comparePointB, setComparePointB] = useState<{
    lat: number;
    lon: number;
    name: string;
  } | null>(null);
  const [compareResultA, setCompareResultA] = useState<SeriesAnalysis | null>(
    null
  );
  const [compareResultB, setCompareResultB] = useState<SeriesAnalysis | null>(
    null
  );
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareNarration, setCompareNarration] = useState<string | null>(null);
  const [compareNarrationBusy, setCompareNarrationBusy] = useState(false);

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

  /**
   * Comparar regiones: descarga la serie de cada punto y corre el MISMO
   * motor determinista; luego pide la narración IA de la divergencia
   * (solo texto; respaldo = frase determinista i18n).
   */
  const fetchCompareSeries = async (point: {
    lat: number;
    lon: number;
  }): Promise<SeriesAnalysis | null> => {
    const config = VARIABLE_CONFIG[variable];
    const parameter = config.powerParameters[0];
    const params = new URLSearchParams({
      lat: String(point.lat),
      lon: String(point.lon),
      parameter,
      start: `${startYear}0101`,
      end: `${endYear}1231`
    });
    const response = await fetch(`/api/power/daily?${params}`);
    const data = (await response.json()) as { points?: TimePoint[] };
    if (!response.ok || !data.points || data.points.length < 10) return null;
    return analyzeDailySeries(data.points, {
      variable,
      season,
      threshold: config.threshold,
      periodStart: `${startYear}0101`,
      periodEnd: `${endYear}1231`
    });
  };

  const fetchCompareNarration = async (
    a: SeriesAnalysis,
    b: SeriesAnalysis
  ) => {
    setCompareNarrationBusy(true);
    setCompareNarration(null);
    try {
      const response = await fetch('/api/compare-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locale,
          comparison: {
            regionA: comparePointA?.name ?? 'A',
            regionB: comparePointB?.name ?? 'B',
            variable,
            season,
            unit: VARIABLE_CONFIG[variable].unit,
            slopeA: a.trend.senSlopePerDecade,
            pA: a.trend.pFdr ?? a.trend.mannKendall.p,
            ciALow: a.trend.ci95PerDecade.lower,
            ciAHigh: a.trend.ci95PerDecade.upper,
            slopeB: b.trend.senSlopePerDecade,
            pB: b.trend.pFdr ?? b.trend.mannKendall.p,
            ciBLow: b.trend.ci95PerDecade.lower,
            ciBHigh: b.trend.ci95PerDecade.upper
          }
        })
      });
      const data = (await response.json()) as { text?: string };
      if (!response.ok || !data.text) return; // respaldo: frase determinista
      setCompareNarration(data.text);
    } catch {
      // respaldo: la frase determinista ya se muestra siempre
    } finally {
      setCompareNarrationBusy(false);
    }
  };

  const runComparison = async (
    a: { lat: number; lon: number; name: string },
    b: { lat: number; lon: number; name: string }
  ) => {
    setCompareBusy(true);
    try {
      const [resultA, resultB] = await Promise.all([
        fetchCompareSeries(a),
        fetchCompareSeries(b)
      ]);
      if (!resultA || !resultB) {
        setCompareMode('pickA');
        setComparePointA(null);
        setComparePointB(null);
        return;
      }

      // Dos regiones = dos hipótesis probadas a la vez: corrección por
      // comparaciones múltiples (Benjamini-Hochberg) sobre la familia
      // {A, B}. El p ajustado alimenta la narración y la insignia de
      // significancia del panel comparativo.
      const [pAdjA, pAdjB] = benjaminiHochberg([
        resultA.trend.mannKendall.p,
        resultB.trend.mannKendall.p
      ]);
      resultA.trend.pFdr = pAdjA;
      resultB.trend.pFdr = pAdjB;
      resultA.trend.significant =
        pAdjA < 0.05 && resultA.trend.mannKendall.trend !== 'no-trend';
      resultB.trend.significant =
        pAdjB < 0.05 && resultB.trend.mannKendall.trend !== 'no-trend';

      setCompareResultA(resultA);
      setCompareResultB(resultB);
      setCompareMode('done');
      void fetchCompareNarration(resultA, resultB);
    } catch {
      setCompareMode('pickA');
    } finally {
      setCompareBusy(false);
    }
  };

  const exitCompareMode = () => {
    setCompareMode('off');
    setComparePointA(null);
    setComparePointB(null);
    setCompareResultA(null);
    setCompareResultB(null);
    setCompareNarration(null);
  };

  /** Respaldo determinista si la IA no narra: la frase i18n con los números. */
  const deterministicSentence = () => {
    if (!compareResultA || !compareResultB) return '';
    const trendWord = (slope: number) =>
      slope > 0
        ? td('results.trendIncreasing')
        : slope < 0
          ? td('results.trendDecreasing')
          : td('results.trendNone');
    const formatP = (p: number) =>
      p < 0.001 ? '< 0.001' : p.toFixed(3);
    return tc('sentence', {
      regionA: comparePointA?.name ?? 'A',
      trendA: trendWord(compareResultA.trend.senSlopePerDecade),
      slopeA: `${compareResultA.trend.senSlopePerDecade > 0 ? '+' : ''}${compareResultA.trend.senSlopePerDecade.toFixed(2)}`,
      pA: formatP(compareResultA.trend.mannKendall.p),
      regionB: comparePointB?.name ?? 'B',
      trendB: trendWord(compareResultB.trend.senSlopePerDecade),
      slopeB: `${compareResultB.trend.senSlopePerDecade > 0 ? '+' : ''}${compareResultB.trend.senSlopePerDecade.toFixed(2)}`,
      pB: formatP(compareResultB.trend.mannKendall.p),
      unit: VARIABLE_CONFIG[variable].unit
    });
  };

  const handleSelectLocation = (loc: {
    lat: number;
    lon: number;
    name: string;
    country: string;
    presetId?: string;
  }) => {
    // En modo comparación, los clics fijan las regiones A y B.
    if (compareMode === 'pickA') {
      setComparePointA({ lat: loc.lat, lon: loc.lon, name: loc.name });
      setCompareMode('pickB');
      return;
    }
    if (compareMode === 'pickB') {
      setComparePointB({ lat: loc.lat, lon: loc.lon, name: loc.name });
      void runComparison(comparePointA ?? { lat: loc.lat, lon: loc.lon, name: loc.name }, {
        lat: loc.lat,
        lon: loc.lon,
        name: loc.name
      });
      return;
    }
    setSelected(loc);
    // Tocar el mapa cierra el panel de resultados: el globo se re-centra.
    setResultsOpen(false);
  };

  /** URL del Modo Detective con todo el estado del escenario. */
  /**
   * Consulta en vivo contra /api/power/daily y corre el MISMO motor
   * determinista (Mann-Kendall + Sen + IC) en el navegador: el resultado
   * se muestra dentro del panel, sin salir del mapa.
   */
  /**
   * Pide el informe narrado (Gemini si hay clave; resumen determinista si no)
   * con las cifras ya calculadas. Silencioso: si falla, el análisis numérico
   * del panel derecho ya está visible y eso es lo esencial.
   */
  const fetchAiReport = async (result: SeriesAnalysis) => {
    setAiBusy(true);
    setAiReport(null);
    try {
      const response = await fetch('/api/detective-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          locale,
          analysis: {
            variableId: variable,
            season,
            periodStart: String(startYear),
            periodEnd: String(endYear),
            slopePerDecade: result.trend.senSlopePerDecade,
            ciLow: result.trend.ci95PerDecade.lower,
            ciHigh: result.trend.ci95PerDecade.upper,
            pValue: result.trend.mannKendall.p,
            n: result.trend.n,
            significant: result.trend.significant,
            // null = sin horizonte: infinito o absurdo (> 1000 años).
            yearsNeeded:
              Number.isFinite(result.years.years) &&
              result.years.years <= YEARS_NEEDED_PRACTICAL_LIMIT
                ? result.years.years
                : null
          }
        })
      });
      const data = (await response.json()) as {
        text?: string;
        engine?: 'gemini' | 'template';
        fallback?: boolean;
      };
      if (!response.ok || !data.text || !data.engine) return;
      setAiReport({
        text: data.text,
        engine: data.engine,
        fallback: data.fallback === true
      });
    } catch {
      // Silencioso a propósito: el análisis determinista sigue visible.
    } finally {
      setAiBusy(false);
    }
  };

  /**
   * Núcleo compartido: consulta /api/power/daily y corre el MISMO motor
   * determinista (Mann-Kendall + Sen + IC) en el navegador. Devuelve el
   * análisis o null; NO dispara la IA (eso lo decide cada botón).
   */
  const runAnalysis = async (): Promise<SeriesAnalysis | null> => {
    setIsFetching(true);
    setFetchError(false);
    setAnalysis(null);
    try {
      const config = VARIABLE_CONFIG[variable];
      const parameter = config.powerParameters[0];
      const params = new URLSearchParams({
        lat: String(selected.lat),
        lon: String(selected.lon),
        parameter,
        start: `${startYear}0101`,
        end: `${endYear}1231`
      });

      const response = await fetch(`/api/power/daily?${params}`);
      const data = (await response.json()) as {
        points?: TimePoint[];
        errorCode?: string;
      };

      if (!response.ok || !data.points || data.points.length < 10) {
        throw new Error(data.errorCode ?? 'invalid_payload');
      }

      const result = analyzeDailySeries(data.points, {
        variable,
        season,
        threshold: config.threshold,
        periodStart: `${startYear}0101`,
        periodEnd: `${endYear}1231`
      });

      setAnalysis(result);
      // Abre el panel grande de resultados (izquierda) y desplaza el mapa.
      setResultsOpen(true);
      // En móvil, despliega el acordeón para que el resultado sea visible.
      setMobilePanelOpen(true);
      return result;
    } catch {
      setFetchError(true);
      return null;
    } finally {
      setIsFetching(false);
    }
  };

  // Botón del panel derecho ("Consultar NASA POWER"): SOLO cifras.
  const handleConsult = async () => {
    setAiReport(null);
    await runAnalysis();
  };

  // Botón del panel izquierdo ("Investigar este lugar"): cifras + informe
  // narrado. Acción independiente de la anterior.
  const handleInvestigate = async () => {
    const result = await runAnalysis();
    if (result) void fetchAiReport(result);
  };

  /** Scroll suave a la sección de resultados completa (bajo el mapa). */
  const scrollToResults = () => {
    document
      .getElementById('questions')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
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
            communityPoints={showPins ? communityPins : []}
            comparePoints={
              compareMode !== 'off'
                ? [
                    ...(comparePointA
                      ? [
                          {
                            lat: comparePointA.lat,
                            lon: comparePointA.lon,
                            label: 'A'
                          }
                        ]
                      : []),
                    ...(comparePointB
                      ? [
                          {
                            lat: comparePointB.lat,
                            lon: comparePointB.lon,
                            label: 'B'
                          }
                        ]
                      : [])
                  ]
                : []
            }
            onSelectLocation={handleSelectLocation}
          />
        </motion.div>

        {/* Capa HUD: paneles flotantes translúcidos */}
        <motion.div
          style={{ opacity: hudOpacity, y: hudTranslateY }}
          className="pointer-events-none absolute inset-0 z-20"
        >
          {/* Móvil: botón que despliega/plega la ficha de misión. Mientras
              está plegada, el globo queda libre a pantalla completa.
              En escritorio este botón no existe. */}
          <button
            type="button"
            onClick={() => {
              const next = !mobileMissionOpen;
              setMobileMissionOpen(next);
              // En móvil solo un panel abierto a la vez: el otro se pliega.
              if (next) setMobilePanelOpen(false);
            }}
            aria-expanded={mobileMissionOpen}
            className="pointer-events-auto absolute left-3 top-20 z-30 flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-slate-950/80 px-3 py-2 text-[11px] font-semibold text-cyan-200 shadow-xl backdrop-blur-md transition-colors hover:bg-slate-800 md:hidden"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('mobileMission')}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                mobileMissionOpen ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>

          {/* Panel izquierdo: ficha de misión del detective. En móvil es un
              panel DESPLEGABLE (plegado por defecto para ver el globo); en
              escritorio es fijo y expandido como siempre. */}
          <div
            className={`pointer-events-auto absolute left-3 right-3 top-32 z-30 max-h-[calc(100vh-16rem)] overflow-y-auto md:left-6 md:right-auto md:w-[400px] ${
              mobileMissionOpen ? 'block' : 'hidden'
            } md:block`}
          >
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

              {/* CTA principal: analiza AQUÍ MISMO (sin salir del mapa) y
                  narra el caso con IA. Acción independiente del botón
                  "Consultar" del panel derecho (solo cifras). */}
              <button
                type="button"
                onClick={handleInvestigate}
                disabled={isFetching}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {isFetching ? t('analyzing') : t('investigate')}
              </button>

              {/* Subir un dato propio (foto o manual): la celda no es tu calle.
                  Requiere cuenta; el modal lo gestiona. */}
              <button
                type="button"
                onClick={() => setUploadOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-white/[0.12]"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {th('uploadButton')}
              </button>

              {/* Comparar regiones: se eligen DOS puntos con clics sobre
                  el globo; el resultado flota sobre el mapa. */}
              <button
                type="button"
                onClick={() => {
                  if (compareMode === 'off') {
                    setCompareMode('pickA');
                  } else {
                    exitCompareMode();
                  }
                }}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  compareMode !== 'off'
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'
                    : 'border-white/10 bg-white/[0.06] text-cyan-200 hover:bg-white/[0.12]'
                }`}
              >
                <GitCompareArrows className="h-3.5 w-3.5" aria-hidden />
                {compareMode !== 'off'
                  ? tc('exitCompare')
                  : tc('compareRegions')}
              </button>

              {/* Datos de la comunidad en la celda seleccionada (públicos) */}
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-wide text-emerald-300">
                    {t('community.title')}
                  </p>
                  <span className="font-mono text-[10px] tabular-nums text-emerald-200/80">
                    {communityNearby.length}
                  </span>
                </div>

                {communityNearby.length > 0 ? (
                  <ul className="mt-1.5 space-y-1">
                    {communityNearby.slice(0, 4).map((obs, index) => (
                      <li
                        key={`${obs.username}-${obs.observedAt}-${index}`}
                        className="flex items-baseline justify-between gap-2 font-mono text-[10px] leading-snug text-slate-300"
                      >
                        <span className="truncate text-emerald-200">
                          @{obs.username}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {obs.value} {obs.unit} · {obs.observedAt}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[10px] leading-snug text-slate-400">
                    {t('community.empty')}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void togglePins()}
                  disabled={communityBusy}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {communityBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <MapPin className="h-3 w-3" aria-hidden />
                  )}
                  {showPins ? t('community.hidePins') : t('community.showPins')}
                </button>
              </div>

              {/* Informe del caso, narrado por IA sobre las cifras ya
                  calculadas (o resumen determinista si no hay clave). */}
              {(aiBusy || aiReport) && (
                <div className="rounded-xl border border-white/15 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-cyan-300">
                      {td('report.title')}
                    </span>
                    {aiReport && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
                          aiReport.engine === 'gemini'
                            ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                            : 'border-slate-600 bg-slate-800 text-slate-300'
                        }`}
                      >
                        {aiReport.engine === 'gemini'
                          ? td('report.badgeGemini')
                          : aiReport.fallback
                            ? td('report.badgeFallback')
                            : td('report.badgeTemplate')}
                      </span>
                    )}
                  </div>

                  {aiBusy ? (
                    <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      {td('report.loading')}
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-200">
                        {aiReport?.text}
                      </p>
                      <p className="mt-2 text-[9px] leading-snug text-slate-500">
                        {aiReport?.engine === 'gemini'
                          ? td('report.aiDisclaimer')
                          : td('report.templateDisclaimer')}
                      </p>
                    </>
                  )}
                </div>
              )}

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

          {/* Panel derecho: variables y periodo. Al consultar, este MISMO
              cuadro se expande hacia la izquierda (anclado a la derecha)
              mostrando los resultados dentro. El mapa queda centrado. */}
          <div
            className={`pointer-events-auto absolute right-4 top-32 max-h-[calc(100vh-15rem)] w-[calc(100%-2rem)] overflow-y-auto transition-[width] duration-500 ease-out sm:right-6 sm:top-20 ${
              analysis && resultsOpen
                ? 'sm:w-[620px]'
                : 'sm:w-[360px]'
            }`}
          >
            <div className="flex flex-col gap-3.5 rounded-2xl border border-white/15 bg-slate-950/75 p-4 text-slate-100 shadow-2xl backdrop-blur-md sm:p-5">
              {/* Header: en MÓVIL es un botón de acordeón (plegado por
                  defecto para ver el globo); en escritorio solo título. */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !mobilePanelOpen;
                    setMobilePanelOpen(next);
                    // En móvil solo un panel abierto a la vez.
                    if (next) setMobileMissionOpen(false);
                  }}
                  aria-expanded={mobilePanelOpen}
                  className="flex flex-1 items-center justify-between gap-2 text-left"
                >
                  <span>
                    <h2 className="text-sm font-semibold text-white">
                      {t('variablesTitle')}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {t('variablesSubtitle')}
                    </p>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-cyan-300 transition-transform sm:hidden ${
                      mobilePanelOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>
                <span className="font-mono text-[11px] tabular-nums text-cyan-300">
                  {VARIABLE_CONFIG[variable].powerParameters[0]}
                </span>
              </div>

              {/* Contenido plegable en móvil; siempre expandido en escritorio. */}
              <div className={`${mobilePanelOpen ? 'flex' : 'hidden'} flex-col gap-3.5 sm:flex`}>

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
                      title={t(`seasonHint.${seasonId}`)}
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
                <p className="mt-1.5 font-mono text-[9px] leading-snug text-slate-500">
                  {t('seasonLegend')}
                </p>
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
                    {YEAR_OPTIONS.map((year) => (
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
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      // Ajuste simétrico: nunca dejar fin <= inicio.
                      if (value <= startYear) setStartYear(1981);
                      setEndYear(value);
                    }}
                    className="w-full rounded-lg border border-white/15 bg-slate-900/90 px-2.5 py-1.5 font-mono text-xs tabular-nums text-slate-100 focus:border-cyan-400 focus:outline-none"
                  >
                    {YEAR_OPTIONS.map((year) => (
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
                  onClick={handleConsult}
                  disabled={isFetching}
                  className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isFetching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Radio className="h-3.5 w-3.5" />
                  )}
                  {isFetching ? t('analyzing') : t('consult')}
                </button>

                {fetchError && !isFetching && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-snug text-amber-300">
                    {td('errors.apiFailed')}
                  </p>
                )}

                {/* Resultados DENTRO de este panel (el cuadro se expandió
                    hacia la izquierda): legibles y con botón para el
                    informe completo. Se cierran con la X o tocando el mapa. */}
                {analysis && resultsOpen && !isFetching && (
                  <div className="space-y-3 rounded-xl border border-cyan-400/30 bg-slate-950/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-mono text-[11px] uppercase leading-snug tracking-wide text-cyan-300">
                        {td(`variables.${analysis.trend.variable}.label`)} ·{' '}
                        {td(`seasons.${analysis.trend.season}`)} · {startYear}–
                        {endYear}
                      </p>
                      <button
                        type="button"
                        onClick={() => setResultsOpen(false)}
                        aria-label={t('resultClose')}
                        className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400">
                      {selected.name} · {selected.lat.toFixed(2)}°,{' '}
                      {selected.lon.toFixed(2)}°
                    </p>

                    {/* Pendiente de Sen: número grande y legible */}
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-3xl font-bold tabular-nums text-white">
                        {analysis.trend.senSlopePerDecade > 0 ? '+' : ''}
                        {analysis.trend.senSlopePerDecade.toFixed(2)}
                      </span>
                      <span className="font-mono text-sm text-slate-400">
                        {VARIABLE_CONFIG[analysis.trend.variable].unit} /{' '}
                        {td('results.perDecade')}
                      </span>
                    </div>

                    <p className="font-mono text-sm tabular-nums text-cyan-300">
                      {td('results.confidenceInterval')}:{' '}
                      [{analysis.trend.ci95PerDecade.lower.toFixed(2)},{' '}
                      {analysis.trend.ci95PerDecade.upper.toFixed(2)}]
                    </p>

                    <p className="font-mono text-sm tabular-nums text-slate-300">
                      {td('results.pValue')} ={' '}
                      {analysis.trend.mannKendall.p.toExponential(1)}
                      {' · '}
                      {td('results.yearsAnalyzed')} = {analysis.trend.n}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-lg border px-3 py-1 font-mono text-sm font-semibold ${
                          analysis.trend.significant
                            ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                            : 'border-white/20 bg-white/5 text-slate-300'
                        }`}
                      >
                        {analysis.trend.significant
                          ? td('results.significantYes')
                          : td('results.significantNo')}
                      </span>
                      {Number.isFinite(analysis.years.years) && (
                        <span
                          title={t('yearsNoteWhy')}
                          className="cursor-help rounded-lg border border-white/20 bg-white/5 px-3 py-1 font-mono text-xs text-slate-400"
                        >
                          {analysis.years.years <= YEARS_NEEDED_PRACTICAL_LIMIT
                            ? t('yearsNoteShort', {
                                years: analysis.years.years
                              })
                            : t('yearsNoteImpractical')}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={scrollToResults}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
                    >
                      <span>{t('viewFull')}</span>
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                )}

                <p className="text-[11px] leading-snug text-slate-400">
                  {t('previewNote')}
                </p>
              </div>
              </div>
              {/* ^ fin del contenido plegable en móvil */}
            </div>
          </div>
        </motion.div>

        {/* Hint del modo comparación: guía los clics sobre el globo y
            avisa mientras se descargan ambas series ("Comparando…"). */}
        {(compareMode === 'pickA' || compareMode === 'pickB') && !compareBusy && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute left-1/2 top-20 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2"
          >
            <div className="rounded-xl border border-amber-400/50 bg-slate-950/85 p-3 text-center shadow-2xl backdrop-blur-md">
              <p className="text-sm font-semibold text-amber-200">
                {compareMode === 'pickA'
                  ? tc('pickA')
                  : tc('pickB', {
                      region: comparePointA?.name ?? 'A'
                    })}
              </p>
              <p className="mt-1 font-mono text-[10px] text-slate-400">
                {td(`variables.${variable}.label`)} ·{' '}
                {td(`seasons.${season}`)} · {startYear}–{endYear}
              </p>
            </div>
          </motion.div>
        )}

        {/* Mensaje "Comparando…" mientras se descargan ambas series */}
        {compareBusy && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute left-1/2 top-20 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2"
          >
            <div className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/50 bg-slate-950/85 p-3 text-center shadow-2xl backdrop-blur-md">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" aria-hidden />
              <p className="text-sm font-semibold text-cyan-200">
                {tc('comparing')}
              </p>
            </div>
          </motion.div>
        )}

        {/* Comparación de regiones: cuadro flotante que se mueve con el
            mapa. Divergencia calculada en código; la IA solo narra. */}
        {compareMode === 'done' && compareResultA && compareResultB && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute bottom-8 left-4 right-4 z-30 md:left-6 md:right-auto md:w-[560px]"
          >
            <div className="space-y-3 rounded-2xl border border-amber-400/40 bg-slate-950/85 p-5 shadow-2xl backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-[11px] uppercase leading-snug tracking-wide text-amber-300">
                  {tc('panelTitle')} · {td(`variables.${variable}.label`)} ·{' '}
                  {startYear}–{endYear}
                </p>
                <button
                  type="button"
                  onClick={exitCompareMode}
                  aria-label={tc('exitCompare')}
                  className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {/* Tarjetas A/B con barras proporcionales (misma escala) */}
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    [comparePointA?.name ?? 'A', compareResultA],
                    [comparePointB?.name ?? 'B', compareResultB]
                  ] as const
                ).map(([name, result]) => {
                  const slope = result.trend.senSlopePerDecade;
                  const scale = Math.max(
                    0.0001,
                    Math.abs(compareResultA.trend.senSlopePerDecade),
                    Math.abs(compareResultB.trend.senSlopePerDecade)
                  );
                  return (
                    <div
                      key={name}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                    >
                      <p className="truncate text-xs font-bold text-white">
                        {name}
                      </p>
                      <p className="mt-1 font-mono text-xl font-bold tabular-nums text-cyan-300">
                        {slope > 0 ? '+' : ''}
                        {slope.toFixed(2)}
                      </p>
                      <div className="mt-1.5 h-2 w-full rounded-full bg-slate-800">
                        <div
                          className={`h-2 rounded-full transition-all duration-700 ${
                            slope > 0
                              ? 'bg-amber-400'
                              : slope < 0
                                ? 'bg-cyan-400'
                                : 'bg-slate-600'
                          }`}
                          style={{
                            width: `${Math.max(2, (Math.abs(slope) / scale) * 100)}%`
                          }}
                        />
                      </div>
                      <p className="mt-1.5 font-mono text-[10px] tabular-nums text-slate-400">
                        p ={' '}
                        {result.trend.mannKendall.p < 0.001
                          ? '< 0.001'
                          : result.trend.mannKendall.p.toFixed(3)}{' '}
                        · {result.trend.significant ? '🟢' : '🟡'}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Divergencia determinista + narración IA */}
              <p className="font-mono text-sm tabular-nums text-amber-300">
                {tc('divergence', {
                  diff: Math.abs(
                    compareResultA.trend.senSlopePerDecade -
                      compareResultB.trend.senSlopePerDecade
                  ).toFixed(2),
                  unit: VARIABLE_CONFIG[variable].unit
                })}
              </p>
              <p className="text-xs leading-relaxed text-slate-300">
                {compareNarrationBusy ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    {tc('narrating')}
                  </span>
                ) : (
                  (compareNarration ?? deterministicSentence())
                )}
              </p>
              <p className="text-[9px] leading-snug text-slate-500">
                {tc('aiNote')}
              </p>
            </div>
          </motion.div>
        )}

        {/* Indicador de scroll */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-slate-400">
          <span className="text-[11px]">{t('scrollCue')}</span>
          <ChevronDown className="h-4 w-4 animate-bounce text-cyan-400" aria-hidden />
        </div>
      </div>
      </div>

      {/* ===== Resultados: MISMA RUTA, bajo el mapa. Las 4 preguntas se
               responden con los datos reales obtenidos (motor determinista);
               nunca texto pre-escrito. ===== */}
      <section
        id="questions"
        className="mx-auto max-w-[1360px] scroll-mt-24 px-6 pb-16"
      >
        <header className="mb-6 border-b border-slate-800 pb-3">
          <h2 className="text-xl font-bold text-white md:text-2xl">
            {th('questions.title')}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {th('questions.subtitle')}
          </p>
        </header>

        {!analysis && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-6">
            <p className="text-sm leading-relaxed text-slate-400">
              {th('questions.emptyHint')}
            </p>
          </div>
        )}

        {analysis && (
          <div>
            {/* Línea de contexto de la investigación */}
            <p className="mb-4 font-mono text-xs leading-relaxed text-slate-400">
              {selected.name} · {selected.lat.toFixed(2)}°,{' '}
              {selected.lon.toFixed(2)}° · {startYear}–{endYear} ·{' '}
              {td('results.gridCell')}
            </p>

            {/* Las 4 respuestas con datos reales */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {/* 01. ¿Qué está cambiando? */}
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5">
                <div>
                  <span className="text-xs font-medium text-slate-400">
                    01. {td('results.what')}
                  </span>
                  <div className="mt-3 flex items-center gap-2 text-sm font-bold text-white">
                    {(() => {
                      const Icon = VARIABLE_ICONS[analysis.trend.variable];
                      return (
                        <Icon
                          className="h-4 w-4 shrink-0 text-cyan-400"
                          aria-hidden
                        />
                      );
                    })()}
                    {td(`variables.${analysis.trend.variable}.label`)}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {td(`seasons.${analysis.trend.season}`)} ·{' '}
                    {analysis.trend.mannKendall.trend === 'increasing'
                      ? td('results.trendIncreasing')
                      : analysis.trend.mannKendall.trend === 'decreasing'
                        ? td('results.trendDecreasing')
                        : td('results.trendNone')}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  <span>{td('results.source')}: NASA POWER · MERRA-2</span>
                </div>
              </div>

              {/* 02. ¿Dónde está cambiando? */}
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5">
                <div>
                  <span className="text-xs font-medium text-slate-400">
                    02. {td('results.where')}
                  </span>
                  <p className="mt-3 text-sm font-bold text-white">
                    {selected.name}
                  </p>
                  <p className="mt-1 font-mono text-xs text-cyan-300">
                    {selected.lat.toFixed(2)}°, {selected.lon.toFixed(2)}°
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  <span>{td('results.whereNote')}</span>
                </div>
              </div>

              {/* 03. ¿Cuánto está cambiando? */}
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5">
                <div>
                  <span className="text-xs font-medium text-slate-400">
                    03. {td('results.howMuch')}
                  </span>
                  <p className="mt-3 font-mono text-2xl font-bold tabular-nums text-white">
                    {analysis.trend.senSlopePerDecade > 0 ? '+' : ''}
                    {analysis.trend.senSlopePerDecade.toFixed(2)}{' '}
                    <span className="text-sm text-slate-400">
                      {VARIABLE_CONFIG[analysis.trend.variable].unit}/
                      {td('results.perDecade')}
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-xs tabular-nums text-cyan-300">
                    {td('results.confidenceInterval')}:{' '}
                    [{analysis.trend.ci95PerDecade.lower.toFixed(2)},{' '}
                    {analysis.trend.ci95PerDecade.upper.toFixed(2)}]
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  <span>
                    {analysis.trend.ci95PerDecade.lower *
                      analysis.trend.ci95PerDecade.upper >
                    0
                      ? td('results.ciSameSign')
                      : td('results.ciCrossesZero')}
                  </span>
                </div>
              </div>

              {/* 04. ¿Es significativo? */}
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5">
                <div>
                  <span className="text-xs font-medium text-slate-400">
                    04. {td('results.significant')}
                  </span>
                  <p className="mt-3">
                    <span
                      className={`inline-flex rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold ${
                        analysis.trend.significant
                          ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                          : 'border-white/20 bg-white/5 text-slate-300'
                      }`}
                    >
                      {analysis.trend.significant
                        ? td('results.significantYes')
                        : td('results.significantNo')}
                    </span>
                  </p>
                  <p className="mt-2 font-mono text-xs tabular-nums text-slate-300">
                    {td('results.pValue')} ={' '}
                    {analysis.trend.mannKendall.p.toExponential(1)} ·{' '}
                    {td('results.yearsAnalyzed')} = {analysis.trend.n}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                  <span>
                    {analysis.trend.significant
                      ? td('results.alphaNote')
                      : td('results.validResultNote')}
                  </span>
                </div>
              </div>
            </div>

            {/* Gráfico: serie anual + recta de Sen + banda de confianza */}
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/90 p-5">
              <TrendChart
                data={(() => {
                  const values = analysis.annual.map((p) => p.value);
                  const fit = senFit(
                    values,
                    analysis.trend.senSlopePerDecade / 10
                  );
                  const lowerSlope = analysis.trend.ci95PerDecade.lower / 10;
                  const upperSlope = analysis.trend.ci95PerDecade.upper / 10;
                  return analysis.annual.map((p, i) => ({
                    year: Number(p.date.slice(0, 4)),
                    value: p.value,
                    fit: fit.fitAt(i),
                    band: [
                      fit.intercept + lowerSlope * i,
                      fit.intercept + upperSlope * i
                    ] as [number, number]
                  }));
                })()}
                unit={VARIABLE_CONFIG[analysis.trend.variable].unit}
                labels={{
                  value: td('chart.value'),
                  fit: td('chart.fit'),
                  band: td('chart.band'),
                  year: td('chart.year')
                }}
              />
            </div>

            {/* ¿Cuántos años necesitaría un sensor local? */}
            <div className="mt-6 rounded-xl border border-blue-500/30 bg-blue-500/5 p-6">
              <p className="text-sm font-semibold text-blue-400">
                {td('results.yearsNeededTitle')}
              </p>
              {Number.isFinite(analysis.years.years) &&
              analysis.years.years <= YEARS_NEEDED_PRACTICAL_LIMIT ? (
                <p className="mt-2 text-sm text-slate-300">
                  {td('results.yearsNeededBody', {
                    years: String(analysis.years.years)
                  })}
                </p>
              ) : Number.isFinite(analysis.years.years) ? (
                <p className="mt-2 text-sm text-slate-300">
                  {td('results.yearsNeededHuge')}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-300">
                  {td('results.yearsNeededInfinite')}
                </p>
              )}
              <p className="mt-2 border-t border-blue-500/20 pt-2 text-xs leading-relaxed text-slate-400">
                {td('results.yearsNeededWhy')}
              </p>
            </div>

            {/* Datos comunitarios en esta celda: comparados contra la celda
                NASA en paralelo (sesgo calculado en código determinista). */}
            {communityNearby.length > 0 && (
              <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
                <p className="text-sm font-semibold text-emerald-400">
                  {t('community.cellTitle', {
                    count: communityNearby.length
                  })}
                </p>
                <ul className="mt-3 space-y-2">
                  {communityNearby.slice(0, 10).map((obs, index) => (
                    <li
                      key={`${obs.username}-${obs.observedAt}-${index}`}
                      className="flex flex-wrap items-baseline gap-x-2 border-b border-emerald-500/10 pb-1.5 text-xs text-slate-300 last:border-b-0"
                    >
                      <span className="font-semibold text-emerald-300">
                        @{obs.username}
                      </span>
                      <span className="font-mono tabular-nums">
                        {obs.value} {obs.unit}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span>{obs.observedAt}</span>
                      {obs.bias !== null && (
                        <>
                          <span className="text-slate-500">·</span>
                          <span
                            className={
                              obs.verdict === 'plausible'
                                ? 'text-emerald-300'
                                : obs.verdict === 'suspicious'
                                  ? 'text-amber-400'
                                  : 'text-slate-400'
                            }
                          >
                            {obs.verdict === 'plausible' &&
                              t('community.verdictPlausible')}
                            {obs.verdict === 'doubtful' &&
                              t('community.verdictDoubtful')}
                            {obs.verdict === 'suspicious' &&
                              t('community.verdictSuspicious')}
                            {obs.verdict === 'no_reference' &&
                              t('community.verdictNoReference')}
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {(() => {
                  const biases = communityNearby
                    .map((obs) => obs.bias)
                    .filter((bias): bias is number => bias !== null);
                  if (biases.length === 0) return null;
                  const mean =
                    biases.reduce((sum, bias) => sum + bias, 0) / biases.length;
                  return (
                    <p className="mt-3 border-t border-emerald-500/20 pt-2 font-mono text-xs text-slate-300">
                      {t('community.meanBias', {
                        bias: mean.toFixed(2),
                        unit: VARIABLE_CONFIG[analysis.trend.variable].unit
                      })}
                    </p>
                  );
                })()}
                <p className="mt-1 text-[10px] leading-snug text-slate-500">
                  {t('community.comparedNote')}
                </p>
              </div>
            )}

            {/* Publicar el expediente al Tablón de Casos: el usuario
                aporta hipótesis + nota de campo; el servidor recalcula. */}
            {analysis && (
              <button
                type="button"
                onClick={() => setCaseOpen(true)}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-3 text-sm font-bold text-cyan-200 transition-colors hover:bg-cyan-500/20"
              >
                <FolderArchive className="h-4 w-4" aria-hidden />
                {th('archiveCase')}
              </button>
            )}

            {/* Expediente científico: documento imprimible (PDF) con fuente
                exacta, método, IC, validación y limitaciones. Compartible
                por URL: recalcula el mismo resultado en el servidor. */}
            {analysis && (
              <a
                href={`/${locale}/dossier?lat=${selected.lat}&lon=${selected.lon}&variable=${analysis.trend.variable}&season=${analysis.trend.season}&startYear=${startYear}&endYear=${endYear}&place=${encodeURIComponent(selected.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
              >
                <FileText className="h-4 w-4" aria-hidden />
                {th('dossierLink')}
              </a>
            )}

            {/* Informe del detective: IA si hay clave; resumen local si no.
                Se genera solo al montar; la IA solo redacta cifras ya calculadas. */}
            <DetectiveReport
              geminiAvailable={aiAvailable}
              analysisPayload={{
                variableId: analysis.trend.variable,
                season: analysis.trend.season,
                periodStart: String(startYear),
                periodEnd: String(endYear),
                slopePerDecade: analysis.trend.senSlopePerDecade,
                ciLow: analysis.trend.ci95PerDecade.lower,
                ciHigh: analysis.trend.ci95PerDecade.upper,
                pValue: analysis.trend.mannKendall.p,
                n: analysis.trend.n,
                significant: analysis.trend.significant,
                // null = sin horizonte: infinito o absurdo (> 1000 años).
                yearsNeeded:
                  Number.isFinite(analysis.years.years) &&
                  analysis.years.years <= YEARS_NEEDED_PRACTICAL_LIMIT
                    ? analysis.years.years
                    : null
              }}
            />

            {/* Glosario */}
            <details className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-200">
                {td('glossary.title')}
              </summary>
              <div className="mt-4 space-y-3 text-sm text-slate-400">
                <p>{td('glossary.pValue')}</p>
                <p>{td('glossary.senSlope')}</p>
                <p>{td('glossary.confidenceInterval')}</p>
              </div>
            </details>
          </div>
        )}
      </section>

      {/* Modal "Sube tu dato": observación comunitaria con evidencia.
          Flota sobre el globo; el usuario no sale del mapa. */}
      <ObservationModal open={uploadOpen} onClose={() => setUploadOpen(false)} />

      {/* Modal "Archivar como caso": publica el expediente al tablón. */}
      <CaseModal
        open={caseOpen}
        onClose={() => setCaseOpen(false)}
        investigation={
          analysis
            ? {
                lat: selected.lat,
                lon: selected.lon,
                placeName: selected.name,
                variable: analysis.trend.variable,
                season: analysis.trend.season,
                startYear,
                endYear
              }
            : null
        }
      />
    </div>
  );
}