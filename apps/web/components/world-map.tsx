'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  geoContains,
  geoDistance,
  geoGraticule10,
  geoOrthographic,
  geoPath
} from 'd3-geo';
import { feature } from 'topojson-client';
// Atlas 110m (~10× menos vértices que el 50m): el render del globo es el
// cuello de botella en cada frame de rotación/drag, y a la escala de las
// celdas de NASA POWER (~50 km) la diferencia visual es mínima. Con 50m
// el arrastre se sentía a bajos FPS, especialmente en móviles.
import countriesAtlas from 'world-atlas/countries-110m.json';
import {
  Crosshair,
  Globe2,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

/**
 * Rango de zoom del globo. El máximo alto (64x) permite acercarse hasta la
 * escala de calle DENTRO de la celda MERRA-2: la celda en sí no puede ser
 * más pequeña (es la resolución real de los datos de la NASA, ~50 x 70 km),
 * pero así el usuario ve que su calle cabe dentro de ella.
 */
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 64;

/**
 * Globo terráqueo 3D interactivo (proyección ortográfica con d3-geo).
 * Portado del prototipo de referencia "Calle vs. Cielo" y adaptado a
 * Next.js con i18n: arrastra para rotar, lupas/rueda (con clic presionado)
 * para zoom, clic para elegir un punto y vuelo animado por región.
 */

export interface MapCity {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  isFlagship?: boolean;
}

export type RegionKey =
  | 'world'
  | 'south_america'
  | 'paraguay'
  | 'north_america'
  | 'europe'
  | 'africa'
  | 'asia';

export const REGION_VIEWS: Record<
  RegionKey,
  { target: [number, number]; zoom: number }
> = {
  world: { target: [-45, -10], zoom: 1 },
  south_america: { target: [-60, -20], zoom: 2.3 },
  paraguay: { target: [-58.2, -23.5], zoom: 6.2 },
  north_america: { target: [-98, 40], zoom: 2.1 },
  europe: { target: [12, 48], zoom: 3.1 },
  africa: { target: [20, 2], zoom: 2.2 },
  asia: { target: [98, 32], zoom: 2.1 }
};

/** Países localizados (es); en inglés se usa el nombre del atlas. */
const COUNTRY_ES: Record<string, string> = {
  Paraguay: 'Paraguay',
  Argentina: 'Argentina',
  Brazil: 'Brasil',
  Bolivia: 'Bolivia',
  Uruguay: 'Uruguay',
  Chile: 'Chile',
  Peru: 'Perú',
  Colombia: 'Colombia',
  Ecuador: 'Ecuador',
  Venezuela: 'Venezuela',
  'United States of America': 'Estados Unidos',
  Canada: 'Canadá',
  Mexico: 'México',
  Spain: 'España',
  France: 'Francia',
  Germany: 'Alemania',
  Italy: 'Italia',
  'United Kingdom': 'Reino Unido',
  Portugal: 'Portugal',
  Kenya: 'Kenia',
  'South Africa': 'Sudáfrica',
  Nigeria: 'Nigeria',
  Egypt: 'Egipto',
  Japan: 'Japón',
  India: 'India',
  China: 'China',
  Australia: 'Australia',
  Norway: 'Noruega',
  Sweden: 'Suecia',
  Greenland: 'Groenlandia'
};

type GeoFeature = { properties?: { name?: string } } & Record<string, unknown>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Observación comunitaria pública para pines en el globo. */
export interface CommunityPoint {
  lat: number;
  lon: number;
  username: string;
  variable: string;
  value: number;
  unit: string;
}

/** Puntos de comparación de regiones: marcadores A/B visibles. */
export interface ComparePoint {
  lat: number;
  lon: number;
  /** 'A' o 'B' */
  label: string;
}

interface WorldMapProps {
  cities: MapCity[];
  selectedLat: number;
  selectedLon: number;
  selectedName: string;
  selectedCountry: string;
  /** Se incrementa para volar suavemente hacia el punto seleccionado. */
  focusKey?: number;
  /** Pines de datos comunitarios (opcional; se muestran como esmeralda). */
  communityPoints?: CommunityPoint[];
  /** Marcadores A/B del comparador de regiones (ámbar y cian). */
  comparePoints?: ComparePoint[];
  onSelectLocation: (loc: {
    lat: number;
    lon: number;
    name: string;
    country: string;
    presetId?: string;
  }) => void;
}

export function WorldMap({
  cities,
  selectedLat,
  selectedLon,
  selectedName,
  selectedCountry,
  focusKey = 0,
  communityPoints = [],
  comparePoints = [],
  onSelectLocation
}: WorldMapProps) {
  const t = useTranslations('home.map');
  const locale = useLocale();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [size, setSize] = useState({ width: 1280, height: 720 });
  const [rotation, setRotation] = useState<[number, number, number]>([
    57.5, 22, 0
  ]);
  const [zoom, setZoom] = useState(1);
  const [autoSpin, setAutoSpin] = useState(true);
  const [isHoveringGlobe, setIsHoveringGlobe] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverCoords, setHoverCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    startRot: [number, number, number];
    movedDist: number;
    vx: number;
    vy: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startRot: [57.5, 22, 0],
    movedDist: 0,
    vx: 0,
    vy: 0
  });

  const toLocalCountry = (name: string | undefined): string => {
    if (!name) return t('ocean');
    return locale === 'es' ? (COUNTRY_ES[name] ?? name) : name;
  };

  // Medir el contenedor en píxeles CSS exactos (1 unidad SVG == 1 px).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Globo centrado en la PÁGINA: los paneles del HUD son translúcidos y
  // flotan sobre el mapa, así que no hay razón para desplazar el centro.
  // (Antes usaba width*0.41 en escritorio para compensar el panel derecho,
  // lo que dejaba el mundo visiblemente corrido a la izquierda.)
  const centerX = size.width * 0.5;
  const centerY = size.height * 0.52;
  const baseRadius = Math.min(size.width * 0.44, size.height * 0.44);

  // Zoom con rueda SOLO con clic izquierdo presionado (no interrumpe el scroll).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handleWheel = (event: WheelEvent) => {
      const leftButtonHeld =
        (event.buttons & 1) === 1 || dragStateRef.current.active;
      if (!leftButtonHeld) return;

      event.preventDefault();
      dragStateRef.current.movedDist = Math.max(
        dragStateRef.current.movedDist,
        10
      );
      setAutoSpin(false);
      const factor = event.deltaY < 0 ? 1.15 : 0.87;
      setZoom((current) =>
        clamp(Number((current * factor).toFixed(2)), MIN_ZOOM, MAX_ZOOM)
      );
    };
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, []);

  const countriesGeo = useMemo(() => {
    const topo = countriesAtlas as unknown as Parameters<typeof feature>[0];
    const objects = (countriesAtlas as unknown as {
      objects: Record<string, Parameters<typeof feature>[1]>;
    }).objects;
    return feature(topo, objects.countries) as unknown as {
      features: GeoFeature[];
    };
  }, []);

  const projection = useMemo(
    () =>
      geoOrthographic()
        .scale(baseRadius * zoom)
        .translate([centerX, centerY])
        .rotate(rotation)
        .clipAngle(90),
    [baseRadius, zoom, centerX, centerY, rotation]
  );

  const pathGenerator = useMemo(() => geoPath().projection(projection), [
    projection
  ]);
  const graticulePath = useMemo(
    () => pathGenerator(geoGraticule10() as never) ?? '',
    [pathGenerator]
  );
  const spherePath = useMemo(
    () => pathGenerator({ type: 'Sphere' } as never) ?? '',
    [pathGenerator]
  );

  // Celda MERRA-2 0.5° lat × 0.625° lon alrededor del punto seleccionado.
  const merra2CellPath = useMemo(() => {
    const dLat = 0.5;
    const dLon = 0.625;
    const cellLatMin = Math.floor(selectedLat / dLat) * dLat;
    const cellLonMin = Math.floor(selectedLon / dLon) * dLon;
    const cellGeo = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          [
            [cellLonMin, cellLatMin],
            [cellLonMin + dLon, cellLatMin],
            [cellLonMin + dLon, cellLatMin + dLat],
            [cellLonMin, cellLatMin + dLat],
            [cellLonMin, cellLatMin]
          ]
        ]
      }
    };
    return pathGenerator(cellGeo as never) ?? '';
  }, [selectedLat, selectedLon, pathGenerator]);

  // Vuelo animado (rotación + zoom) hacia un objetivo.
  const flyTo = (targetLon: number, targetLat: number, targetZoom: number) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const startRot = [...rotation] as [number, number, number];
    const startZoom = zoom;
    const endRot: [number, number, number] = [-targetLon, -targetLat, 0];

    // Menor delta angular de longitud.
    let dLon = endRot[0] - startRot[0];
    while (dLon > 180) dLon -= 360;
    while (dLon < -180) dLon += 360;
    const dLat = endRot[1] - startRot[1];

    const duration = 520;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      // Ease-out cúbico.
      const ease = 1 - Math.pow(1 - progress, 3);
      setRotation([
        startRot[0] + dLon * ease,
        clamp(startRot[1] + dLat * ease, -85, 85),
        0
      ]);
      setZoom(startZoom + (targetZoom - startZoom) * ease);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  };

  // Rotación ambiental suave cuando está en reposo y sin zoom.
  // Throttle a ~30 FPS: redibujar 240 países a 60 FPS sobrecarga la CPU
  // (es la causa de los bajos FPS percibidos); a 30 el giro se ve igual
  // de suave y libera la mitad del trabajo de render por segundo.
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (
      !autoSpin ||
      prefersReducedMotion ||
      isHoveringGlobe ||
      isDragging ||
      zoom > 1.8
    )
      return;
    let rafId = 0;
    let last = performance.now();
    const MIN_FRAME_MS = 33; // ~30 FPS
    const tick = (now: number) => {
      const dt = now - last;
      if (dt >= MIN_FRAME_MS) {
        last = now;
        setRotation((prev) => [(prev[0] + dt * 0.008) % 360, prev[1], 0]);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [autoSpin, isHoveringGlobe, isDragging, zoom]);

  // Volar suavemente cuando el padre lo pide (preset externo).
  useEffect(() => {
    if (focusKey === 0) return;
    setAutoSpin(false);
    flyTo(selectedLon, selectedLat, Math.max(zoom, 2.3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  const handleSelectRegion = (region: RegionKey) => {
    const view = REGION_VIEWS[region];
    if (region !== 'world') setAutoSpin(false);
    flyTo(view.target[0], view.target[1], view.zoom);
  };

  // Inversión precisa píxel → [lon, lat] + país bajo el cursor.
  const invertPointerToGlobe = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg || !projection.invert) return null;
    const rect = svg.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    // Solo dentro del disco visible del globo.
    if (Math.hypot(px - centerX, py - centerY) > baseRadius * zoom) return null;

    const inverted = projection.invert([px, py]);
    if (!inverted) return null;
    const [lon, lat] = inverted;
    if (Number.isNaN(lon) || Number.isNaN(lat)) return null;

    let matchedCountry: string | undefined;
    for (const geoFeature of countriesGeo.features) {
      if (geoContains(geoFeature as never, [lon, lat])) {
        matchedCountry = geoFeature.properties?.name;
        break;
      }
    }

    // Redondeo automático a 2 decimales (resolución más fina que la celda
    // MERRA-2 de 0.5° x 0.625°): -23.6879 -> -23.69, sin avisos al usuario.
    return {
      lat: Number(lat.toFixed(2)),
      lon: Number(lon.toFixed(2)),
      hasCountry: Boolean(matchedCountry),
      countryEs: toLocalCountry(matchedCountry)
    };
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      startRot: [...rotation] as [number, number, number],
      movedDist: 0,
      vx: 0,
      vy: 0
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const dragState = dragStateRef.current;
    if (dragState.active) {
      const dx = event.clientX - dragState.lastX;
      const dy = event.clientY - dragState.lastY;
      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;
      dragState.movedDist += Math.hypot(dx, dy);

      // Sensibilidad inversa al zoom: control fino al acercar.
      const sensitivity = 0.28 / Math.max(1, zoom * 0.75);
      dragState.vx = dx * sensitivity;
      dragState.vy = -dy * sensitivity;

      setRotation((prev) => [
        prev[0] + dragState.vx,
        clamp(prev[1] + dragState.vy, -85, 85),
        0
      ]);
      return;
    }

    const hover = invertPointerToGlobe(event.clientX, event.clientY);
    if (hover) {
      setHoverCoords({ lat: hover.lat, lon: hover.lon });
      setHoveredCountry(hover.hasCountry ? hover.countryEs : null);
    } else {
      setHoverCoords(null);
      setHoveredCountry(null);
    }
  };

  const handlePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState.active) return;
    dragState.active = false;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // Si el puntero casi no se movió: clic preciso de ubicación.
    if (dragState.movedDist < 5) {
      const hit = invertPointerToGlobe(event.clientX, event.clientY);
      if (hit) {
        onSelectLocation({
          lat: hit.lat,
          lon: hit.lon,
          name: hit.hasCountry
            ? t('pointInCountry', { country: hit.countryEs })
            : t('openPoint'),
          country: hit.countryEs
        });
      }
      return;
    }

    // Planeo inercial suave al soltar.
    let vx = dragState.vx;
    let vy = dragState.vy;
    const glide = () => {
      vx *= 0.92;
      vy *= 0.92;
      if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) {
        animFrameRef.current = null;
        return;
      }
      setRotation((prev) => [
        prev[0] + vx,
        clamp(prev[1] + vy, -85, 85),
        0
      ]);
      animFrameRef.current = requestAnimationFrame(glide);
    };
    animFrameRef.current = requestAnimationFrame(glide);
  };

  // ¿El punto está en el hemisferio frontal visible?
  const isVisibleOnFront = (lon: number, lat: number) => {
    const centerGeo: [number, number] = [-rotation[0], -rotation[1]];
    return geoDistance([lon, lat], centerGeo) < Math.PI / 2 - 0.02;
  };

  const selectedVisible = isVisibleOnFront(selectedLon, selectedLat);
  const selectedPoint = selectedVisible
    ? projection([selectedLon, selectedLat])
    : null;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#050811]"
    >
      {/* Viñeta espacial sutil */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_41%_52%,rgba(34,211,238,0.10),transparent_60%)]"
      />

      {/* Globo 3D ortográfico en SVG a pantalla completa */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className={`block h-full w-full touch-none select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        role="img"
        aria-label={t('ariaGlobe')}
        onPointerEnter={() => setIsHoveringGlobe(true)}
        onPointerLeave={() => {
          setIsHoveringGlobe(false);
          setHoverCoords(null);
          setHoveredCountry(null);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <radialGradient id="globe-ocean" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#0E223D" />
            <stop offset="65%" stopColor="#081326" />
            <stop offset="100%" stopColor="#040812" />
          </radialGradient>
          <radialGradient id="globe-atmosphere" cx="50%" cy="50%" r="52%">
            <stop offset="88%" stopColor="rgba(34,211,238,0)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.18)" />
          </radialGradient>
        </defs>

        {/* Esfera del océano + borde atmosférico */}
        <path
          d={spherePath}
          fill="url(#globe-ocean)"
          stroke="#1E3A5F"
          strokeWidth={1.5}
        />

        {/* Retícula */}
        <path
          d={graticulePath}
          fill="none"
          stroke="#1E293B"
          strokeWidth={0.7}
          strokeOpacity={0.75}
        />

        {/* Países (resolución 50m) */}
        <g>
          {countriesGeo.features.map((geoFeature, index) => {
            const rawName = geoFeature.properties?.name;
            const localName = toLocalCountry(rawName);
            const isSelectedCountry =
              rawName &&
              (selectedCountry === localName || selectedCountry === rawName);
            const isHovered = hoveredCountry === localName;
            const d = pathGenerator(geoFeature as never);
            if (!d) return null;

            return (
              <path
                key={`${rawName ?? 'c'}-${index}`}
                d={d}
                fill={
                  isSelectedCountry
                    ? '#164E63'
                    : isHovered
                      ? '#1E3A5F'
                      : '#111C30'
                }
                stroke={
                  isSelectedCountry
                    ? '#22D3EE'
                    : isHovered
                      ? '#38BDF8'
                      : '#334155'
                }
                strokeWidth={
                  isSelectedCountry
                    ? 1.5
                    : isHovered
                      ? 1.15
                      : zoom > 2
                        ? 0.85
                        : 0.65
                }
              />
            );
          })}
        </g>

        {/* Halo atmosférico */}
        <path
          d={spherePath}
          fill="url(#globe-atmosphere)"
          className="pointer-events-none"
        />

        {/* Celda MERRA-2 0.5° × 0.625° del punto seleccionado */}
        {merra2CellPath && (
          <path
            d={merra2CellPath}
            fill="#F59E0B"
            fillOpacity={0.34}
            stroke="#FBBF24"
            strokeWidth={1.6}
            className="pointer-events-none"
          />
        )}

        {/* Pines de datos comunitarios (esmeralda, con tooltip).
            Ciencia ciudadana visible sobre el globo. */}
        {communityPoints.map((obs, index) => {
          if (!isVisibleOnFront(obs.lon, obs.lat)) return null;
          const point = projection([obs.lon, obs.lat]);
          if (!point) return null;
          const [cx, cy] = point;
          return (
            <g key={`community-${index}`} transform={`translate(${cx}, ${cy})`}>
              <title>
                {`@${obs.username} · ${obs.value} ${obs.unit}`}
              </title>
              <circle r={5} fill="#10B981" fillOpacity={0.25} />
              <circle
                r={2.6}
                fill="#34D399"
                stroke="#050811"
                strokeWidth={1.2}
              />
            </g>
          );
        })}

        {/* Marcadores A/B del comparador de regiones (ámbar/cian, grandes) */}
        {comparePoints.map((cp) => {
          if (!isVisibleOnFront(cp.lon, cp.lat)) return null;
          const point = projection([cp.lon, cp.lat]);
          if (!point) return null;
          const [cx, cy] = point;
          const isA = cp.label === 'A';
          return (
            <g
              key={`compare-${cp.label}`}
              transform={`translate(${cx}, ${cy})`}
              className="pointer-events-none"
            >
              <circle
                r={11}
                fill={isA ? '#F59E0B' : '#22D3EE'}
                fillOpacity={0.3}
              />
              <circle
                r={5.5}
                fill={isA ? '#F59E0B' : '#22D3EE'}
                stroke="#050811"
                strokeWidth={1.8}
              />
              <text
                x={0}
                y={2.2}
                textAnchor="middle"
                fontSize={7}
                fontWeight={800}
                fill="#050811"
                className="select-none"
              >
                {cp.label}
              </text>
            </g>
          );
        })}

        {/* Pines de ciudades predefinidas (solo hemisferio frontal) */}
        {cities.map((city) => {
          if (!isVisibleOnFront(city.lon, city.lat)) return null;
          const point = projection([city.lon, city.lat]);
          if (!point) return null;
          const [cx, cy] = point;
          const isActive =
            Math.abs(selectedLat - city.lat) < 0.01 &&
            Math.abs(selectedLon - city.lon) < 0.01;

          return (
            <g
              key={city.id}
              transform={`translate(${cx}, ${cy})`}
              className="cursor-pointer"
              onClick={() => {
                setAutoSpin(false);
                flyTo(city.lon, city.lat, Math.max(zoom, 2.2));
                onSelectLocation({
                  lat: city.lat,
                  lon: city.lon,
                  name: city.name,
                  country: city.country,
                  presetId: city.id
                });
              }}
            >
              <circle
                r={isActive ? 13 : city.isFlagship ? 8.5 : 6.5}
                fill={
                  isActive
                    ? '#22D3EE'
                    : city.isFlagship
                      ? '#F59E0B'
                      : '#38BDF8'
                }
                fillOpacity={isActive ? 0.25 : 0.16}
              />
              <circle
                r={isActive ? 5 : 3.6}
                fill={
                  isActive
                    ? '#22D3EE'
                    : city.isFlagship
                      ? '#F59E0B'
                      : '#E2E8F0'
                }
                stroke="#050811"
                strokeWidth={1.6}
              />
              <text
                x={9}
                y={4}
                fontSize={12}
                fontWeight={isActive ? 700 : 500}
                fill={isActive ? '#E0F2FE' : '#CBD5E1'}
                className="pointer-events-none select-none"
                style={{
                  paintOrder: 'stroke',
                  stroke: '#050811',
                  strokeWidth: '3.5px',
                  strokeLinejoin: 'round'
                }}
              >
                {city.name}
              </text>
            </g>
          );
        })}

        {/* Retícula del punto seleccionado */}
        {selectedPoint && (
          <g
            transform={`translate(${selectedPoint[0]}, ${selectedPoint[1]})`}
            className="pointer-events-none"
          >
            <circle
              r={15}
              fill="none"
              stroke="#22D3EE"
              strokeWidth={1.4}
              strokeDasharray="3 3"
            />
            <line x1={-21} y1={0} x2={-7} y2={0} stroke="#22D3EE" strokeWidth={1.5} />
            <line x1={7} y1={0} x2={21} y2={0} stroke="#22D3EE" strokeWidth={1.5} />
            <line x1={0} y1={-21} x2={0} y2={-7} stroke="#22D3EE" strokeWidth={1.5} />
            <line x1={0} y1={7} x2={0} y2={21} stroke="#22D3EE" strokeWidth={1.5} />
          </g>
        )}
      </svg>
      {/* Indicación de arrastre y zoom (arriba-izquierda) */}
      <div className="pointer-events-none absolute left-6 top-20 z-10 hidden items-center gap-2.5 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md sm:flex">
        <Globe2 className="h-3.5 w-3.5 text-cyan-400" />
        <span>{t('dragHint')}</span>
      </div>

      {/* Telemetría inferior-izquierda: regiones, lupas y coordenadas */}
      <div className="pointer-events-none absolute bottom-5 left-4 z-20 flex max-w-[calc(100vw-2rem)] flex-col gap-2.5 sm:left-6 lg:max-w-[58vw]">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {/* Barra de regiones */}
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-white/15 bg-slate-950/75 p-1 backdrop-blur-md">
            {(Object.keys(REGION_VIEWS) as RegionKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSelectRegion(key)}
                className="shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                {t(`regions.${key}`)}
              </button>
            ))}
          </div>

          {/* Lupas: zoom + rotación */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-slate-950/75 p-1 text-xs backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setAutoSpin(false);
                setZoom((current) =>
                  clamp(Number((current * 1.45).toFixed(2)), MIN_ZOOM, MAX_ZOOM)
                );
              }}
              className="rounded-lg p-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
              title={t('zoomIn')}
              aria-label={t('zoomIn')}
            >
              <ZoomIn className="h-4 w-4 text-cyan-300" />
            </button>
            <span className="px-1.5 font-mono text-[11px] tabular-nums text-cyan-300">
              {zoom.toFixed(1)}×
            </span>
            <button
              type="button"
              onClick={() => {
                setAutoSpin(false);
                setZoom((current) =>
                  clamp(Number((current / 1.45).toFixed(2)), MIN_ZOOM, MAX_ZOOM)
                );
              }}
              className="rounded-lg p-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
              title={t('zoomOut')}
              aria-label={t('zoomOut')}
            >
              <ZoomOut className="h-4 w-4 text-slate-300" />
            </button>
            <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-white/15" />
            <button
              type="button"
              onClick={() => setAutoSpin((spin) => !spin)}
              className="rounded-lg p-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
              title={t('spin')}
              aria-label={t('spin')}
            >
              {autoSpin ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoSpin(false);
                flyTo(selectedLon, selectedLat, Math.max(zoom, 3.2));
              }}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-cyan-200 transition-colors hover:bg-cyan-500/20"
              title={t('focusPoint')}
            >
              <RotateCcw className="h-3 w-3" />
              <span>{t('focusPoint')}</span>
            </button>
          </div>
        </div>

        {/* Lectura de telemetría del punto seleccionado */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-white/15 bg-slate-950/75 px-4 py-2.5 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            <span className="font-semibold text-white">{selectedName}</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="text-slate-300">{selectedCountry}</span>
          </div>
          <span
            aria-hidden="true"
            className="hidden text-slate-700 sm:inline"
          >
            |
          </span>
          <span className="font-mono tabular-nums text-cyan-300">
            {selectedLat.toFixed(2)}°, {selectedLon.toFixed(2)}°
          </span>
          {hoverCoords && (
            <>
              <span
                aria-hidden="true"
                className="hidden text-slate-700 md:inline"
              >
                |
              </span>
              <span className="hidden items-center gap-1.5 font-mono tabular-nums text-slate-300 md:inline-flex">
                <Crosshair className="h-3 w-3 text-slate-400" />
                {hoveredCountry ? `${hoveredCountry} · ` : ''}
                {hoverCoords.lat.toFixed(2)}°, {hoverCoords.lon.toFixed(2)}°
              </span>
            </>
          )}
          <span className="ml-auto hidden items-center gap-1.5 text-amber-300 sm:inline-flex">
            <span className="inline-block h-2.5 w-2.5 border border-amber-400 bg-amber-400/30" />
            {t('cellBadge')}
          </span>
        </div>
      </div>
    </div>
  );
}

