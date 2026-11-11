import { expect, test, type Page } from "@playwright/test";

// Los 5 escenarios con su guion; cada prueba exige 0 errores de consola.
function vigilaConsola(page: Page) {
  const errores: string[] = [];
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
  page.on("pageerror", (e) => errores.push(e.message));
  return errores;
}

const chat = (page: Page) => page.getByTestId("owner-chat");
const siguiente = (page: Page) => page.getByRole("button", { name: /Siguiente mensaje del cliente/ });
// El detalle técnico (Rayos X) está plegado en un <details>: se abre antes de mirarlo.
const estadoTecnico = async (page: Page) => {
  await page.getByText("Ver detalle técnico (para el jurado)").click();
  return page.getByTestId("state-machine").locator('[aria-current="step"]');
};

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
  await expect(page.getByTestId("scenario-btn-feliz")).toContainText("Cita confirmada");
  await expect(await estadoTecnico(page)).toContainText("CERRADO");
  expect(errores).toEqual([]);
});

test("sintoma_critico: el caso llega a la Bandeja y el guion se agota", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-sintoma_critico").click();
  await siguiente(page).click();
  await expect(page.getByTestId("advisor-inbox").getByTestId("handoff-card").first()).toBeVisible();
  await expect(page.getByTestId("scenario-btn-sintoma_critico")).toContainText("¡Necesita asesor!");
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
  await expect(page.getByTestId("scenario-btn-adversarial")).toContainText("Bloqueado por seguridad");
  await expect(await estadoTecnico(page)).toContainText("BLOQUEADO");
  expect(errores).toEqual([]);
});

test("sin_consentimiento: no se envía mensaje de contacto", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-sin_consentimiento").click();
  await expect(chat(page).getByText(/no se envía mensaje/).first()).toBeVisible();
  // T20 · C: nota interna del sistema (el cliente no la ve), sin tarjeta de bloqueo en el teléfono.
  await expect(chat(page).getByRole("note")).toContainText("Nota interna · no se envió nada al cliente");
  await expect(chat(page).getByTestId("card-bloqueo")).toHaveCount(0);
  await expect(chat(page).getByTestId("card-cotizacion")).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("Reiniciar limpia el chat y el guion", async ({ page }) => {
  await page.goto("/?codigo=prueba");
  await expect(page.getByText("Código del jurado activo")).toBeVisible();
  // T20 · D: el código no queda en la barra de direcciones.
  await expect(page).not.toHaveURL(/codigo=/);
  await page.getByTestId("scenario-btn-feliz").click();
  await siguiente(page).click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(siguiente(page)).toBeDisabled();
  await expect(siguiente(page)).toContainText("0/0");
});

test("T20 · A: el paquete no se agrega dos veces y las tarjetas viejas pierden sus botones", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-feliz").click();
  await chat(page).getByRole("button", { name: "Agregar paquete de desgaste" }).click();
  await expect(chat(page).getByText("Paquete de desgaste incluido")).toBeVisible();
  await expect(chat(page).getByRole("button", { name: "Agregar paquete de desgaste" })).toHaveCount(0);
  await expect(chat(page).getByText(/Cotización anterior/)).toHaveCount(1);
  // el guion pide frenos otra vez: el agente no vuelve a cotizar
  await siguiente(page).click();
  await expect(chat(page).getByTestId("card-cotizacion")).toHaveCount(3);
  await siguiente(page).click();
  await expect(chat(page).getByText("El paquete ya está incluido en su cotización. ¿Le agendo la cita?")).toBeVisible();
  await expect(chat(page).getByTestId("card-cotizacion")).toHaveCount(3);
  await chat(page).getByRole("button", { name: "Quitar paquete" }).click();
  await expect(chat(page).getByRole("button", { name: "Agregar paquete de desgaste" })).toHaveCount(1);
  expect(errores).toEqual([]);
});

test("T20 · F2: «Modo libre» oculta el guion sin borrar la conversación", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Demo guiada" })).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("scenario-btn-feliz").click();
  await expect(chat(page).getByTestId("card-cotizacion").first()).toBeVisible();
  await page.getByRole("button", { name: "Modo libre" }).click();
  await expect(siguiente(page)).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Pasos para usar la consola" })).toHaveCount(0);
  await expect(chat(page).getByTestId("card-cotizacion").first()).toBeVisible();
  await page.getByLabel("Escriba su mensaje").fill("¿Cuánto me cuesta?");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(chat(page).getByTestId("card-cotizacion")).toHaveCount(2);
  await page.reload();
  await expect(page.getByRole("button", { name: "Modo libre" })).toHaveAttribute("aria-pressed", "true");
  expect(errores).toEqual([]);
});

test("T20 · G: la reserva aparece en la «Agenda del taller» con su estado", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-feliz").click();
  await chat(page).getByRole("button", { name: "Agendar" }).click();
  await expect(chat(page).getByTestId("card-reserva").first()).toBeVisible();
  await expect(page.getByTestId("agenda-contador")).toContainText("1");
  await page.getByRole("tab", { name: /Agenda del taller/ }).click();
  const cita = page.getByTestId("agenda-cita");
  await expect(cita).toContainText("Mariana S.");
  await expect(cita).toContainText("Reservada");
  await page.getByRole("tab", { name: /Conversación/ }).click();
  await chat(page).getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(chat(page).getByText("Reserva confirmada").first()).toBeVisible();
  await page.getByRole("tab", { name: /Agenda del taller/ }).click();
  await expect(cita).toContainText("Confirmada");
  expect(errores).toEqual([]);
});

test("T22: el asesor toma el caso crítico, responde y queda en la Auditoría como humano", async ({ page }) => {
  const errores = vigilaConsola(page);
  await page.goto("/");
  await page.getByTestId("scenario-btn-sintoma_critico").click();
  await siguiente(page).click();
  const bandeja = page.getByTestId("advisor-inbox");
  await expect(bandeja.getByTestId("handoff-card").first()).toBeVisible();
  await bandeja.getByRole("button", { name: "Tomar caso" }).click();
  await expect(chat(page).getByText(/Carlos R\. \(asesor\) tomó el caso · \d{2}:\d{2}/)).toBeVisible();

  await bandeja.getByLabel("Responder como asesor").fill("Hola Andrés, soy Carlos. Le llamo ya.");
  await bandeja.getByRole("button", { name: "Enviar respuesta" }).click();
  const respuesta = chat(page).getByTestId("mensaje-asesor");
  await expect(respuesta).toContainText("Asesor · Carlos R.");
  await expect(respuesta).toContainText("Hola Andrés, soy Carlos. Le llamo ya.");
  // con el asesor a cargo, la IA no responde
  await page.getByLabel("Escriba su mensaje").fill("¿Ya viene la grúa?");
  await page.getByRole("button", { name: "Enviar mensaje" }).click();
  await expect(chat(page).getByText("La IA está en pausa: le atiende un asesor")).toBeVisible();

  await page.getByRole("tab", { name: /Auditoría/ }).click();
  const entradas = page.getByTestId("auditoria-entrada");
  await expect(entradas.first()).toHaveAttribute("data-autor", "IA");
  await expect(entradas.filter({ hasText: "humano · Carlos R." }).first()).toContainText("Hola Andrés, soy Carlos. Le llamo ya.");
  expect(errores).toEqual([]);
});
