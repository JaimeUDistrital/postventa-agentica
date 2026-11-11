import { expect, test, type Page } from "@playwright/test";

// Los 5 escenarios con su guion; cada prueba exige 0 errores de consola.
function vigilaConsola(page: Page) {
  const errores: string[] = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  page.on("pageerror", (e) => errores.push(e.message));
  return errores;
}

const chat = (page: Page) => page.getByTestId("owner-chat");
const siguiente = (page: Page) => page.getByRole("button", { name: /Siguiente paso del guion/ });

async function paso(page: Page, esperado: string) {
  await siguiente(page).click();
  await expect(chat(page).getByText(esperado).first()).toBeVisible();
}

test("feliz: guion, reserva confirmada y estado CERRADO", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-feliz").click();
  await expect(chat(page).getByTestId("card-cotizacion").first()).toBeVisible();
  await paso(page, "Sí, me interesa. ¿Cuánto me cuesta?");
  await chat(page).getByRole("button", { name: "Agendar" }).last().click();
  await expect(chat(page).getByTestId("card-reserva").first()).toBeVisible();
  await chat(page).getByRole("button", { name: "Confirmar reserva" }).last().click();
  await expect(chat(page).getByText("Reserva confirmada").first()).toBeVisible();
  await expect(page.getByTestId("state-machine").locator('[aria-current="step"]')).toContainText("CERRADO");
  expect(errores).toEqual([]);
});

test("sintoma_critico: el caso llega a la Bandeja y el guion se agota", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-sintoma_critico").click();
  await siguiente(page).click();
  await expect(page.getByTestId("advisor-inbox").getByTestId("handoff-card").first()).toBeVisible();
  await expect(siguiente(page)).toBeDisabled();
  expect(errores).toEqual([]);
});

test("sin_stock: alternativas y caso para el asesor", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-sin_stock").click();
  await siguiente(page).click();
  if ((await chat(page).getByTestId("card-alternativas").count()) === 0) {
    await chat(page).getByRole("button", { name: "Agendar" }).last().click();
  }
  await expect(chat(page).getByTestId("card-alternativas").first()).toBeVisible();
  await expect(page.getByTestId("advisor-inbox").getByTestId("handoff-card").first()).toBeVisible();
  expect(errores).toEqual([]);
});

test("adversarial: el agente bloquea la manipulación", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-adversarial").click();
  await siguiente(page).click();
  await expect(chat(page).getByTestId("card-bloqueo").first()).toBeVisible();
  await expect(page.getByTestId("state-machine").locator('[aria-current="step"]')).toContainText("BLOQUEADO");
  expect(errores).toEqual([]);
});

test("sin_consentimiento: no se envía mensaje de contacto", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-sin_consentimiento").click();
  await expect(chat(page).getByText(/no se envía mensaje/).first()).toBeVisible();
  await expect(chat(page).getByTestId("card-cotizacion")).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("Reiniciar demo limpia el chat y el guion", async ({ page }) => {
  await page.goto("/?codigo=prueba");
  await expect(page.getByText("Código del jurado activo")).toBeVisible();
  await page.getByTestId("scenario-btn-feliz").click();
  await siguiente(page).click();
  await page.getByRole("button", { name: "Reiniciar demo" }).click();
  await expect(siguiente(page)).toBeDisabled();
  await expect(siguiente(page)).toContainText("0/0");
});
