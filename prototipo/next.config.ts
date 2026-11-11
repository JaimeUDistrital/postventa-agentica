import type { NextConfig } from "next";

// cacheComponents desactivado a propósito: la app es interactiva y no necesita caché de
// render; así evitamos fallos de prerender por Date/Math.random en componentes (ADR 0001).
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
