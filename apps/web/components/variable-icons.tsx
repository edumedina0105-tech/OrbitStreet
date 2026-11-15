'use client';

import {
  CloudRain,
  Droplets,
  Flame,
  Gauge,
  Snowflake,
  Sun,
  Thermometer
} from 'lucide-react';
import type { VariableId } from '@orbitstreet/shared-types';

/**
 * Icono por variable: refuerza la lectura visual en el selector del mapa
 * y en las tarjetas de respuesta del Modo Detective.
 * (Cliente: lucide-react renderiza componentes SVG.)
 */
export const VARIABLE_ICONS = {
  T2M: Thermometer,
  T2M_MAX: Sun,
  T2M_MIN: Snowflake,
  RH2M: Droplets,
  PRECTOTCORR: CloudRain,
  PS: Gauge,
  DAYS_ABOVE_THRESHOLD: Flame
} as const;

export type VariableIconComponent =
  (typeof VARIABLE_ICONS)[VariableId];
