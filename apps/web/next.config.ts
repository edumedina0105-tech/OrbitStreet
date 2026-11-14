import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // El paquete de base de datos se distribuye como TypeScript directo.
  transpilePackages: ['@orbitstreet/database']
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

