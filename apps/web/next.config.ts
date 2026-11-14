import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  // Los paquetes internos se distribuyen como TypeScript directo.
  transpilePackages: ['@orbitstreet/database', '@orbitstreet/shared-types']
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);

