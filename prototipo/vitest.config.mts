import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Componentes: `// @vitest-environment jsdom` en la primera línea del test.
    include: [
      "src/**/*.test.{ts,tsx}",
      "checks/**/*.test.{ts,tsx}",
      "evals/**/*.test.{ts,tsx}",
    ],
  },
});
