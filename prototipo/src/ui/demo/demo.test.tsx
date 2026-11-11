// @vitest-environment jsdom
// T12: los 5 escenarios de punta a punta (página real + route handler real, sin red).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import Home from "@/app/page";

const bodies: Record<string, unknown>[] = [];

beforeEach(() => {
  bodies.length = 0;
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return POST(new Request("http://localhost/api/agent", init));
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const chat = () => screen.getByTestId("owner-chat");
const next = () => screen.getByTestId("script-next") as HTMLButtonElement;
const idle = () => waitFor(() => expect(screen.queryByTestId("typing")).toBeNull());
const estado = () => screen.getByTestId("state-machine").querySelector('[aria-current="step"]')?.textContent ?? "";

async function inicia(id: string) {
  render(<Home />);
  fireEvent.click(screen.getByTestId(`scenario-btn-${id}`));
  await screen.findAllByTestId("trace-event");
  await idle();
}

async function paso() {
  await waitFor(() => expect(next().disabled).toBe(false));
  fireEvent.click(next());
  await idle();
}

async function boton(nombre: string) {
  fireEvent.click((await within(chat()).findAllByRole("button", { name: nombre })).at(-1)!);
  await idle();
}

test("feliz: guion + botones terminan en reserva confirmada y CERRADO", { timeout: 30000 }, async () => {
  await inicia("feliz");
  expect(next().textContent).toContain("0/3");
  await paso();
  expect(within(chat()).getByText("Sí, me interesa. ¿Cuánto me cuesta?")).toBeTruthy();
  await within(chat()).findAllByTestId("card-cotizacion");
  await boton("Agendar");
  await within(chat()).findAllByTestId("card-reserva");
  await boton("Confirmar reserva");
  await waitFor(() => expect(within(chat()).getByText("Reserva confirmada")).toBeTruthy());
  expect(estado()).toContain("CERRADO");
  // el guion avanza y termina deshabilitado
  await paso();
  await paso();
  await waitFor(() => expect(next().textContent).toContain("3/3"));
  expect(next().disabled).toBe(true);
});

test("sintoma_critico: el caso llega a la Bandeja", async () => {
  await inicia("sintoma_critico");
  await paso();
  const inbox = screen.getByTestId("advisor-inbox");
  await within(inbox).findAllByTestId("handoff-card");
  expect(next().disabled).toBe(true);
});

test("sin_stock: alternativas y caso", async () => {
  await inicia("sin_stock");
  await paso();
  if (!screen.queryByTestId("card-alternativas")) await boton("Agendar");
  await within(chat()).findByTestId("card-alternativas");
  await within(screen.getByTestId("advisor-inbox")).findAllByTestId("handoff-card");
});

test("adversarial: bloqueo", async () => {
  await inicia("adversarial");
  await paso();
  await within(chat()).findByTestId("card-bloqueo");
  expect(estado()).toContain("BLOQUEADO");
});

test("sin_consentimiento: no hay mensaje de contacto ni cotización", async () => {
  await inicia("sin_consentimiento");
  expect(within(chat()).queryByTestId("card-alerta_km")).toBeNull();
  expect(within(chat()).queryByTestId("card-cotizacion")).toBeNull();
  expect(within(chat()).getByRole("log").textContent).toContain("no se envía mensaje");
  // contacto proactivo bloqueado; solo responde cuando el cliente escribe
  await paso();
  await within(chat()).findAllByTestId("card-cotizacion");
});

test("Reiniciar demo limpia el paso del guion", async () => {
  await inicia("feliz");
  await paso();
  fireEvent.click(screen.getByRole("button", { name: "Reiniciar demo" }));
  expect(next().textContent).toContain("0/0");
  expect(next().disabled).toBe(true);
});

test("el código del jurado se envía como accessCode y nunca aparece en el DOM", async () => {
  window.history.replaceState({}, "", "/?codigo=JURADO-XYZ");
  render(<Home />);
  await screen.findByText("Código del jurado activo");
  fireEvent.click(screen.getByTestId("scenario-btn-feliz"));
  await screen.findAllByTestId("trace-event");
  expect(bodies.length).toBeGreaterThan(0);
  expect(bodies.every((b) => b.accessCode === "JURADO-XYZ")).toBe(true);
  expect(document.body.innerHTML).not.toContain("JURADO-XYZ");
  expect(window.sessionStorage.getItem("postventa.codigo")).toBe("JURADO-XYZ");
});

test("sin código no se envía accessCode ni se muestra la nota", async () => {
  await inicia("feliz");
  expect(bodies.some((b) => "accessCode" in b)).toBe(false);
  expect(screen.queryByText("Código del jurado activo")).toBeNull();
});
