import { expect, test } from "@playwright/test";

test("camino feliz: alerta, cotización en COP y reserva en 1 clic", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Postventa Agéntica" })).toBeVisible();
  await expect(page.getByTestId("mode-badge")).toHaveText("—");

  await page.getByTestId("scenario-btn-feliz").click();
  const chat = page.getByTestId("owner-chat");
  await expect(chat.getByTestId("card-cotizacion")).toBeVisible();
  await expect(chat.getByTestId("cotizacion-total")).toContainText("$");
  await expect(page.getByTestId("mode-badge")).not.toHaveText("—");

  await chat.getByRole("button", { name: "Agendar" }).click();
  await expect(chat.getByTestId("card-reserva")).toBeVisible();
  await chat.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(chat.getByText("Reserva confirmada")).toBeVisible();
});

test("síntoma crítico muestra el handoff y Reiniciar limpia el chat", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("scenario-btn-sintoma_critico").click();
  await expect(page.getByTestId("card-handoff")).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar demo" }).click();
  await expect(page.getByTestId("card-handoff")).toHaveCount(0);
});

test("layout dividido en escritorio y apilado en móvil", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const a = await page.getByTestId("owner-chat").boundingBox();
  const b = await page.getByTestId("xray-console").boundingBox();
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 2);

  await page.setViewportSize({ width: 390, height: 800 });
  const a2 = await page.getByTestId("owner-chat").boundingBox();
  const b2 = await page.getByTestId("xray-console").boundingBox();
  expect(b2!.y).toBeGreaterThan(a2!.y);
});
