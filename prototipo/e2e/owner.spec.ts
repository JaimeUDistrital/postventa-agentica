import { expect, test } from "@playwright/test";

test("camino feliz: alerta, cotización en COP y reserva en 1 clic", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Postventa Agéntica" })).toBeVisible();
  await expect(page.getByTestId("mode-badge")).toHaveText("En espera");

  await page.getByTestId("scenario-btn-feliz").click();
  const chat = page.getByTestId("owner-chat");
  await expect(chat.getByTestId("card-cotizacion")).toBeVisible();
  await expect(chat.getByTestId("cotizacion-total")).toContainText("$");
  await expect(page.getByTestId("mode-badge")).toHaveText(/Motor: reglas|IA Gemini activa/);
  await expect(page.getByText("Revisó el historial del vehículo")).toBeVisible();

  await chat.getByRole("button", { name: "Agendar" }).click();
  await expect(chat.getByTestId("card-reserva")).toBeVisible();
  await chat.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(chat.getByText("Reserva confirmada")).toBeVisible();
});

test("síntoma crítico muestra el handoff y Reiniciar limpia el chat", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("scenario-btn-sintoma_critico").click();
  await page.getByRole("button", { name: /Siguiente mensaje del cliente/ }).click();
  await expect(page.getByTestId("card-handoff")).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(page.getByTestId("card-handoff")).toHaveCount(0);
});

test("tres columnas en escritorio, dos en tableta y apilado en móvil", async ({ page }) => {
  const caja = async (id: string) => (await page.getByTestId(id).boundingBox())!;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  let lista = await caja("scenario-btn-feliz");
  let chat = await caja("owner-chat");
  let bandeja = await caja("advisor-inbox");
  expect(chat.x).toBeGreaterThan(lista.x + lista.width - 2);
  expect(bandeja.x).toBeGreaterThan(chat.x + chat.width - 2);

  await page.setViewportSize({ width: 1024, height: 800 });
  lista = await caja("scenario-btn-feliz");
  chat = await caja("owner-chat");
  bandeja = await caja("advisor-inbox");
  expect(chat.y).toBeGreaterThan(lista.y);
  expect(bandeja.x).toBeGreaterThan(chat.x + chat.width - 2);

  await page.setViewportSize({ width: 390, height: 800 });
  const a = await caja("scenario-btn-feliz");
  const b = await caja("scenario-btn-sintoma_critico");
  expect(Math.abs(a.y - b.y)).toBeLessThan(2); // selector horizontal
  chat = await caja("owner-chat");
  bandeja = await caja("advisor-inbox");
  expect(bandeja.y).toBeGreaterThan(chat.y);
});

test("T20 · E: a 1366×607 la página no se desplaza y cada columna tiene su propio scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 607 });
  await page.goto("/");
  await page.getByTestId("scenario-btn-feliz").click();
  await expect(page.getByTestId("card-cotizacion").first()).toBeVisible();
  const { alto, ventana } = await page.evaluate(() => ({
    alto: document.documentElement.scrollHeight,
    ventana: window.innerHeight,
  }));
  expect(alto).toBeLessThanOrEqual(ventana);
  // La rueda sobre el panel derecho no saca la cabecera de la vista.
  await page.getByRole("region", { name: "Panel del asesor" }).hover();
  await page.mouse.wheel(0, 1200);
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  for (const col of [
    page.getByRole("navigation", { name: "Clientes de hoy" }),
    page.locator("#conversacion"),
    page.getByRole("region", { name: "Panel del asesor" }),
  ])
    expect(await col.evaluate((el) => getComputedStyle(el).overflowY)).toBe("auto");
  // Sin franja en blanco: la rejilla llega al borde inferior de la ventana.
  const rejilla = (await page.getByTestId("console-grid").boundingBox())!;
  expect(Math.abs(rejilla.y + rejilla.height - ventana)).toBeLessThan(2);
});
