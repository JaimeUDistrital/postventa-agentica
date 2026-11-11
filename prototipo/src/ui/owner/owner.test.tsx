// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { trmCopUsd } from "@/core/config";
import type { ReplyCard } from "@/core/contracts";
import type { ChatMessage, DemoSession } from "@/ui/contracts";
import { formatCop, formatFechaHora } from "./format";
import { OwnerApp } from "./index";

afterEach(cleanup);

function makeSession(over: Partial<DemoSession> = {}): DemoSession {
  return {
    scenarioId: null,
    messages: [],
    turns: [],
    cases: [],
    loading: false,
    error: null,
    mode: null,
    selectScenario: vi.fn(),
    send: vi.fn(),
    act: vi.fn(),
    reset: vi.fn(),
    takeCase: vi.fn(),
    ...over,
  };
}

const msg = (cards: ReplyCard[], texto = "Hola"): ChatMessage => ({ id: "m1", rol: "agente", texto, cards });

const quote = {
  id: "q1",
  vehicleId: "v1",
  hitoKm: 30000,
  items: [
    { concepto: "Mano de obra", sku: null, cantidad: 1, precioUnitarioUsd: 50, totalUsd: 50 },
    { concepto: "Filtro de aceite", sku: "F1", cantidad: 2, precioUnitarioUsd: 10, totalUsd: 20 },
  ],
  subtotalUsd: 70,
  descuentoPct: 0.1,
  totalUsd: 63,
  fuente: "tarifario" as const,
};
const booking = {
  id: "b1",
  vehicleId: "v1",
  slotId: "s1",
  inicio: "2026-11-12T09:00",
  bahia: 2,
  quoteId: "q1",
  repuestosApartados: [],
  idempotencyKey: "idem-12345",
  holdHasta: "2026-11-12T09:15",
  estado: "reservada" as const,
};

function renderCards(cards: ReplyCard[], over: Partial<DemoSession> = {}) {
  const session = makeSession({ messages: [msg(cards)], ...over });
  render(<OwnerApp session={session} />);
  return session;
}

test("formato COP con la TRM de config", () => {
  const esperado = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    70 * trmCopUsd,
  );
  expect(formatCop(70)).toBe(esperado);
  expect(formatCop(70)).toContain("$");
});

test("fecha legible en español y determinista", () => {
  const f = formatFechaHora("2026-11-12T09:00");
  expect(f).toContain("noviembre");
  expect(f).toContain("jueves");
});

test("alerta_km muestra km, hito y días", () => {
  renderCards([{ type: "alerta_km", kmEstimado: 29500, proximoHitoKm: 30000, diasParaHito: 12 }]);
  const c = screen.getByTestId("card-alerta_km");
  expect(c.textContent).toContain("12");
  expect(c.textContent).toContain("29.500");
  expect(c.textContent).toContain("30.000");
});

test("cotizacion: total en COP, USD y botones llaman a act", () => {
  const s = renderCards([{ type: "cotizacion", quote }]);
  expect(screen.getByTestId("cotizacion-total").textContent).toBe(formatCop(63));
  expect(screen.getByTestId("card-cotizacion").textContent).toContain("$63.00 USD");
  fireEvent.click(screen.getByRole("button", { name: "Agendar" }));
  fireEvent.click(screen.getByRole("button", { name: "Agregar paquete de desgaste" }));
  expect(s.act).toHaveBeenNthCalledWith(1, "aceptar_mantenimiento");
  expect(s.act).toHaveBeenNthCalledWith(2, "agregar_venta_cruzada");
});

test("reserva: fecha, bahía y Confirmar reserva", () => {
  const s = renderCards([{ type: "reserva", booking }]);
  const c = screen.getByTestId("card-reserva");
  expect(c.textContent).toContain("noviembre");
  expect(c.textContent).toContain("Bahía 2");
  fireEvent.click(within(c).getByRole("button", { name: "Confirmar reserva" }));
  expect(s.act).toHaveBeenCalledWith("confirmar_reserva");
});

test("reserva confirmada no ofrece confirmar de nuevo", () => {
  renderCards([{ type: "reserva", booking: { ...booking, estado: "confirmada" } }]);
  expect(screen.queryByRole("button", { name: "Confirmar reserva" })).toBeNull();
});

test("alternativas lista franjas y motivo", () => {
  renderCards([
    {
      type: "alternativas",
      motivo: "Ese horario ya no está libre.",
      slots: [{ id: "s2", bahia: 1, inicio: "2026-11-13T10:00", fin: "2026-11-13T12:00", disponible: true, franja: "valle" }],
    },
  ]);
  const c = screen.getByTestId("card-alternativas");
  expect(c.textContent).toContain("Ese horario ya no está libre.");
  expect(c.querySelectorAll("li").length).toBe(1);
});

test("seguro: prima en COP y Ver seguros", () => {
  const s = renderCards([
    {
      type: "seguro",
      ofertas: [{ id: "o1", aseguradora: "Aseguradora X", producto: "Todo riesgo", primaAnualUsd: 500, coberturaResumen: "Cobertura total", comisionAgenciaUsd: 20 }],
    },
  ]);
  expect(screen.getByTestId("card-seguro").textContent).toContain(formatCop(500));
  fireEvent.click(screen.getByRole("button", { name: "Ver seguros" }));
  expect(s.act).toHaveBeenCalledWith("ver_seguros");
});

test("handoff y bloqueo", () => {
  renderCards([
    { type: "handoff", casoId: "c1", mensaje: "Lo comunicamos con un asesor." },
    { type: "bloqueo", motivo: "No podemos ayudarle con eso." },
  ]);
  expect(screen.getByTestId("card-handoff").textContent).toContain("Un asesor humano tomará su caso");
  expect(screen.getByTestId("card-bloqueo").textContent).toContain("No podemos ayudarle con eso.");
});

test("enviar llama a send; error y escribiendo", () => {
  const s = makeSession({ error: "Fallo de red", loading: true });
  render(<OwnerApp session={s} />);
  expect(screen.getByRole("alert").textContent).toContain("Fallo de red");
  expect(screen.getByTestId("typing")).toBeTruthy();
  cleanup();
  const s2 = makeSession();
  render(<OwnerApp session={s2} />);
  fireEvent.change(screen.getByLabelText("Escriba su mensaje"), { target: { value: " hola " } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
  expect(s2.send).toHaveBeenCalledWith("hola");
});

test("guion: «Siguiente mensaje del cliente» con ayuda y contador", () => {
  const nextScript = vi.fn();
  render(<OwnerApp session={makeSession({ scenarioId: "feliz", nextScript, scriptStep: 1, scriptTotal: 3 })} />);
  const b = screen.getByRole("button", { name: /Siguiente mensaje del cliente/ });
  expect(b.textContent).toContain("1/3");
  expect(b.getAttribute("aria-describedby")).toBeTruthy();
  expect(document.getElementById(b.getAttribute("aria-describedby")!)!.textContent).toBe("Simula lo que escribe el cliente");
  fireEvent.click(b);
  expect(nextScript).toHaveBeenCalled();
});
