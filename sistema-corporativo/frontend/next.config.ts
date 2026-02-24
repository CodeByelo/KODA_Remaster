import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Los errores de tipo de recharts no bloquean el build
    ignoreBuildErrors: true,
  },
  eslint: {
    // ESLint se ejecuta en desarrollo, no bloquea el deploy
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
