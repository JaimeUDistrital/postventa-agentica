import { expect, test } from "@playwright/test";

// Humo del esqueleto (Orquestador): las 3 zonas existen y un escenario produce traza.
test("las 3 zonas cargan y un escenario genera traza sin errores de consola", async ({ page }) => {
  const errores: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });

  await page.goto("/");
  await expect(page.getByTestId("owner-chat")).toBeVisible();
  await expect(page.getByTestId("xray-console")).toBeVisible();
  await expect(page.getByTestId("advisor-inbox")).toBeVisible();

  await page.getByTestId("scenario-btn-feliz").click();
  await expect(page.getByTestId("trace-event").first()).toBeVisible();
  await expect(page.getByTestId("memory-panel")).toBeVisible();
  // Captura para revisión visual (el agente la abre con Read).
  await page.screenshot({ path: "test-results/smoke.png", fullPage: true });

  expect(errores).toEqual([]);
});
