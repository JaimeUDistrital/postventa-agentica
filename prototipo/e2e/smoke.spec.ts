import { expect, test } from "@playwright/test";

// Humo del esqueleto (Orquestador): las 3 zonas existen y un escenario produce traza.
test("las 3 zonas cargan y un escenario genera traza sin errores de consola", async ({ page }) => {
  const errores: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errores.push(m.text());
  });

  await page.goto("/");
  await expect(page.getByTestId("owner-chat")).toBeVisible();
  // El detalle técnico está plegado en <details> (T19): se abre antes de comprobarlo.
  await page.getByText("Ver detalle técnico (para el jurado)").click();
  await expect(page.getByTestId("xray-console")).toBeVisible();
  await expect(page.getByTestId("advisor-inbox")).toBeVisible();

  // T20: selector de modo y pestañas de la columna central.
  await expect(page.getByRole("button", { name: "Demo guiada" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("tab", { name: /Conversación/ })).toHaveAttribute("aria-selected", "true");

  await page.getByTestId("scenario-btn-feliz").click();
  await expect(page.getByTestId("trace-event").first()).toBeVisible();
  await expect(page.getByTestId("memory-panel")).toBeVisible();
  await expect(page.getByTestId("mode-badge")).toHaveText(/Motor: reglas|IA Gemini activa/);

  await page.getByRole("tab", { name: /Agenda del taller/ }).click();
  await expect(page.getByTestId("workshop-agenda")).toBeVisible();
  await page.getByRole("tab", { name: /Conversación/ }).click();
  await expect(page.getByTestId("owner-chat")).toBeVisible();
  // Captura para revisión visual (el agente la abre con Read).
  await page.screenshot({ path: "test-results/smoke.png", fullPage: true });

  expect(errores).toEqual([]);
});
