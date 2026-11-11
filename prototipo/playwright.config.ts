import { defineConfig } from "@playwright/test";

// Usa el Chrome del sistema (sin descargar navegadores). El sandbox aísla la red de cada
// comando, así que Playwright arranca su propio `next dev` en el mismo comando; `npm run e2e`
// usa `flock` para que dos agentes nunca levanten dos servidores a la vez (PLAN.md §2).
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
