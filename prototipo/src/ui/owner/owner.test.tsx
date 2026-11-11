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

test("seguro: prima en COP y no vuelve a ofrecer «Ver seguros» (T20 · A2)", () => {
  renderCards([
    {
      type: "seguro",
      ofertas: [{ id: "o1", aseguradora: "Aseguradora X", producto: "Todo riesgo", primaAnualUsd: 500, coberturaResumen: "Cobertura total", comisionAgenciaUsd: 20 }],
    },
  ]);
  expect(screen.getByTestId("card-seguro").textContent).toContain(formatCop(500));
  // Las ofertas ya están en la conversación: el botón solo repetía la misma consulta.
  expect(screen.queryByRole("button", { name: "Ver seguros" })).toBeNull();
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

test("A1 · cotización con paquete: etiqueta «incluido» y «Quitar paquete» en vez de agregarlo otra vez", () => {
  const s = renderCards([{ type: "cotizacion", quote: { ...quote, id: "q_veh-01_30000_VC-PAS-01_0" } }]);
  const c = screen.getByTestId("card-cotizacion");
  expect(within(c).getByText("Paquete de desgaste incluido")).toBeTruthy();
  expect(within(c).queryByRole("button", { name: "Agregar paquete de desgaste" })).toBeNull();
  fireEvent.click(within(c).getByRole("button", { name: "Quitar paquete" }));
  expect(s.act).toHaveBeenCalledWith("rechazar_venta_cruzada");
});

test("A1 · cotización sin paquete no muestra la etiqueta", () => {
  renderCards([{ type: "cotizacion", quote: { ...quote, id: "q_veh-01_30000__0" } }]);
  expect(screen.queryByText("Paquete de desgaste incluido")).toBeNull();
  expect(screen.getByRole("button", { name: "Agregar paquete de desgaste" })).toBeTruthy();
});

test("A2 · solo la tarjeta accionable más reciente tiene botones; las anteriores llevan una nota", () => {
  const mensajes: ChatMessage[] = [
    { id: "m1", rol: "agente", texto: "a", cards: [{ type: "cotizacion", quote }] },
    { id: "m2", rol: "agente", texto: "b", cards: [{ type: "cotizacion", quote: { ...quote, id: "q2" } }] },
  ];
  render(<OwnerApp session={makeSession({ messages: mensajes })} />);
  const [vieja, nueva] = screen.getAllByTestId("card-cotizacion");
  expect(within(vieja).queryAllByRole("button")).toHaveLength(0);
  expect(within(vieja).getByText(/Cotización anterior/)).toBeTruthy();
  expect(within(nueva).getAllByRole("button")).toHaveLength(2);
  expect(within(nueva).queryByText(/Cotización anterior/)).toBeNull();
});

test("A2 · una reserva más reciente deja la cotización como anterior y viceversa", () => {
  const mensajes: ChatMessage[] = [
    { id: "m1", rol: "agente", texto: "a", cards: [{ type: "cotizacion", quote }] },
    { id: "m2", rol: "agente", texto: "b", cards: [{ type: "reserva", booking }] },
    { id: "m3", rol: "agente", texto: "c", cards: [{ type: "alternativas", motivo: "x", slots: [] }] },
  ];
  render(<OwnerApp session={makeSession({ messages: mensajes })} />);
  expect(within(screen.getByTestId("card-cotizacion")).queryAllByRole("button")).toHaveLength(0);
  expect(within(screen.getByTestId("card-reserva")).getByRole("button", { name: "Confirmar reserva" })).toBeTruthy();
  cleanup();
  render(<OwnerApp session={makeSession({ messages: [mensajes[1], { ...mensajes[0], id: "m4" }] })} />);
  const reserva = screen.getByTestId("card-reserva");
  expect(within(reserva).queryByRole("button", { name: "Confirmar reserva" })).toBeNull();
  expect(within(reserva).getByText(/Reserva anterior/)).toBeTruthy();
});

test("el campo de mensaje limita a 1000 caracteres, como el contrato de la API (AgentRequest.message)", () => {
  render(<OwnerApp session={makeSession()} />);
  const campo = screen.getByLabelText("Escriba su mensaje") as HTMLInputElement;
  expect(campo.maxLength).toBe(1000);
});

test("C · un mensaje del sistema se muestra como nota interna que el cliente no ve", () => {
  const nota: ChatMessage = { id: "n1", rol: "sistema", texto: "Sin autorización de contacto por WhatsApp: no se envía mensaje.", cards: [] };
  render(<OwnerApp session={makeSession({ messages: [nota] })} />);
  const el = screen.getByRole("note");
  expect(el.textContent).toContain("Nota interna · no se envió nada al cliente");
  expect(el.textContent).toContain("no se envía mensaje");
});
