// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { AgentTurn } from "@/core/contracts";
import { XrayConsole } from "./index";

afterEach(cleanup);

const ev = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  ts: "2026-11-11T10:00:00.000Z",
  kind: "tool_call",
  agent: "Postventa",
  name: "verificar_stock_y_precio",
  system: "Inventario",
  autonomy: "informar",
  payload: { sku: "ACE-5W30" },
  latencyMs: 12,
  status: "ok",
  detalle: "Consulta de stock",
  ...o,
});
const verdict = {
  allow: true,
  action: "permitir",
  categorias: [],
  reasons: ["sin hallazgos"],
  maskedInput: "hola",
  riskScore: 0.1,
};
const turn = AgentTurn.parse({
  sessionId: "s1",
  turnId: "t1",
  state: "COTIZACION",
  reply: { text: "ok", cards: [] },
  trace: [ev("e1"), ev("e2", { system: "Guardián", status: "blocked", autonomy: "prohibido" }), ev("e3", { system: "LLM", status: "escalated" })],
  guardrail: { entrada: verdict },
  mode: "deterministic",
  memory: {
    proactivo: { contactosUltimos30Dias: 0, optInWhatsapp: true, motivoContacto: null },
    postventa: {
      turnos: 1,
      estado: "COTIZACION",
      perfilVehiculo: { descripcion: "Mazda 3", kmEstimado: 29500, proximoHitoKm: 30000 },
      historialServicios: [],
      cotizacionId: null,
      reservaId: null,
    },
    guardian: { intentosBloqueados: 0, alertas: [] },
    copiloto: { casoAbiertoId: null },
  },
  stateToken: "tok",
});

test("estado vacío", () => {
  render(<XrayConsole turns={[]} />);
  expect(screen.getByText(/Elija un escenario/)).toBeTruthy();
  expect(screen.queryAllByTestId("trace-event")).toHaveLength(0);
});

test("pinta N eventos y el payload se pliega/despliega", () => {
  render(<XrayConsole turns={[turn]} />);
  expect(screen.getAllByTestId("trace-event")).toHaveLength(3);
  const d = screen.getAllByText("Payload JSON")[0].closest("details")!;
  expect(d.open).toBe(false);
  fireEvent.click(screen.getAllByText("Payload JSON")[0]);
  d.open = true;
  expect(d.textContent).toContain("ACE-5W30");
  expect(screen.getAllByTestId("trace-event")[1].textContent).toContain("BLOQUEADO");
  expect(screen.getByText("Autonomía: Prohibido")).toBeTruthy();
});

test("memoria muestra postventa en lista clave: valor", () => {
  render(<XrayConsole turns={[turn]} />);
  const mem = screen.getByTestId("memory-panel");
  expect(mem.textContent).toContain("postventa");
  expect(mem.textContent).toContain("proactivo");
  expect(mem.textContent).toContain("turnos:");
});

test("estado actual resaltado y salidas visibles", () => {
  render(<XrayConsole turns={[turn]} />);
  const cur = document.querySelector('[aria-current="step"]')!;
  expect(cur.textContent).toContain("COTIZACION");
  expect(screen.getByText("HANDOFF")).toBeTruthy();
  expect(screen.getByText("BLOQUEADO", { selector: "li" })).toBeTruthy();
});
