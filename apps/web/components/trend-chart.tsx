'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

/**
 * Gráfico de la serie anual con la recta de Sen y la banda de confianza 95%.
 * Componente cliente (Recharts); todas las etiquetas llegan traducidas
 * desde el servidor como props: nada de texto hardcodeado.
 */

export interface TrendChartDatum {
  year: number;
  value: number;
  fit: number;
  band: [number, number];
}

export interface TrendChartLabels {
  value: string;
  fit: string;
  band: string;
  year: string;
}

export function TrendChart({
  data,
  unit,
  labels
}: {
  data: TrendChartDatum[];
  unit: string;
  labels: TrendChartLabels;
}) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="year"
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            width={48}
            label={{
              value: unit,
              angle: -90,
              position: 'insideLeft',
              fill: '#94a3b8',
              fontSize: 12
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 12
            }}
          />
          <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
          {/* Banda de confianza 95% de la pendiente de Sen. */}
          <Area
            dataKey="band"
            name={labels.band}
            stroke="none"
            fill="#22d3ee"
            fillOpacity={0.12}
            isAnimationActive={false}
          />
          {/* Recta de Sen (tendencia central). */}
          <Line
            type="monotone"
            dataKey="fit"
            name={labels.fit}
            stroke="#22d3ee"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {/* Serie anual observada. */}
          <Line
            type="monotone"
            dataKey="value"
            name={labels.value}
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={{ r: 1.5, fill: '#f59e0b' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
