import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // Salida standalone para el Dockerfile multi-stage (Railway).
  output: 'standalone',
  // Raíz del monorepo para el trazado de archivos de standalone.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  // Los paquetes internos se distribuyen como TypeScript directo.
  transpilePackages: ['@orbitstreet/database', '@orbitstreet/shared-types']
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

