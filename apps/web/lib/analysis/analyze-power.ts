import { prisma, type Prisma } from '@orbitstreet/database';
import type { Locale, SeasonOrAnnual, VariableId } from '@orbitstreet/shared-types';
import { getDailySeries } from '@/lib/power/service';
import { analyzeDailySeries, type SeriesAnalysis } from './analyze-series';
import { VARIABLE_CONFIG, POWER_EARLIEST } from './variables';

/**
 * Capa de servidor del Modo Detective: descarga (o reutiliza en caché)
 * la serie de NASA POWER, corre el análisis determinista y guarda la
 * investigación en la base de datos. La IA jamás participa aquí.
 */

export interface AnalyzeLocationOptions {
  latitude: number;
  longitude: number;
  variable: VariableId;
  /** YYYYMMDD (default: 19810101). */
  start?: string;
  /** YYYYMMDD (default: hoy). */
  end?: string;
  season?: SeasonOrAnnual;
  threshold?: number;
  locale?: Locale;
}

export interface LocationAnalysis extends SeriesAnalysis {
  cached: boolean;
  source: string;
  parameter: string;
  /** true si se guardó la investigación en la DB. */
  saved: boolean;
}

function todayYyyymmdd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

export async function analyzePowerLocation(
  options: AnalyzeLocationOptions
): Promise<LocationAnalysis> {
  const config = VARIABLE_CONFIG[options.variable];
  const start = options.start ?? POWER_EARLIEST;
  const end = options.end ?? todayYyyymmdd();

  // La variable derivada (días > umbral) usa T2M_MAX como parámetro fuente.
  const parameter = config.powerParameters[0];

  const { points, cached, source } = await getDailySeries({
    latitude: options.latitude,
    longitude: options.longitude,
    parameter,
    start,
    end
  });

  const analysis = analyzeDailySeries(points, {
    variable: options.variable,
    season: options.season,
    threshold: options.threshold,
    periodStart: start,
    periodEnd: end
  });

  // Persistir la investigación. Si la DB falla, el análisis igual se devuelve:
  // perder el registro es aceptable; mentir con los datos no lo es.
  let saved = false;
  try {
    await prisma.investigation.create({
      data: {
        locale: options.locale ?? 'es',
        variable: options.variable,
        latitude: Math.round(options.latitude * 100) / 100,
        longitude: Math.round(options.longitude * 100) / 100,
        periodStart: new Date(
          Date.UTC(Number(start.slice(0, 4)), Number(start.slice(4, 6)) - 1, Number(start.slice(6, 8)))
        ),
        periodEnd: new Date(
          Date.UTC(Number(end.slice(0, 4)), Number(end.slice(4, 6)) - 1, Number(end.slice(6, 8)))
        ),
        paramsJson: {
          season: options.season ?? 'ALL',
          threshold: options.threshold ?? config.threshold ?? null,
          start,
          end
        } as unknown as Prisma.InputJsonValue,
        resultJson: {
          trend: analysis.trend,
          sigma: analysis.sigma,
          yearsNeeded: analysis.years
        } as unknown as Prisma.InputJsonValue
      }
    });
    saved = true;
  } catch {
    // Guardado best-effort: no interrumpe la experiencia del detective.
    saved = false;
  }

  return {
    ...analysis,
    cached,
    source,
    parameter,
    saved
  };
}
