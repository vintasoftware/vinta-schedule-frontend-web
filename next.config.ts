import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The design-system workspace package ships TypeScript source, not a build.
  transpilePackages: ['vinta-schedule-design-system'],
};

export default nextConfig;
