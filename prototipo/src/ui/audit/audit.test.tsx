// @vitest-environment jsdom
// T22 · 4: auditoría de la conversación (quién respondió: IA o persona, cuándo y cómo).
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { AgentTurn, TraceEvent } from "@/core/contracts";
import type { ChatMessage } from "@/ui/contracts";
import { formatHoraReloj } from "@/ui/owner/format";
import { AuditTimeline, construirAuditoria } from "./index";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ev = (id: string, kind: TraceEvent["kind"], name: string): TraceEvent => ({
  id, ts: "2026-11-11T15:00:00.000Z", kind, agent: "Postventa", name, system: "Taller", payload: {}, latencyMs: 1, status: "ok",
});
const veredicto = (action: "permitir" | "escalar", categorias: string[] = []) => ({
  allow: action === "permitir", action, categorias, reasons: [], maskedInput: "", riskScore: 0,
});
const turno = { turnId: "t1", mode: "deterministic", trace: [ev("1", "tool_call", "consultar_contexto_vehiculo"), ev("2", "tool_result", "consultar_contexto_vehiculo"), ev("3", "tool_call", "verificar_stock_y_precio")], guardrail: { entrada: veredicto("permitir"), salida: veredicto("permitir") } } as unknown as AgentTurn;
const rutaIa: TraceEvent = { ...ev("r0", "llm", "planner.ruta"), payload: { ruta: "ia", motivo: "x" } };
const turnoGemini = { turnId: "t2", mode: "llm", trace: [rutaIa], guardrail: { entrada: veredicto("escalar", ["sintoma_critico"]) } } as unknown as AgentTurn;

const mensajes: ChatMessage[] = [
  { id: "t1", turnId: "t1", rol: "agente", texto: "Le comparto la cotización", cards: [{ type: "bloqueo", motivo: "x" }], ts: "2026-11-11T15:00:00.000Z" },
  { id: "c1", rol: "cliente", texto: "Huele a quemado", cards: [], ts: "2026-11-11T15:01:00.000Z" },
  { id: "t2", turnId: "t2", rol: "agente", texto: "Un asesor le contactará", cards: [], ts: "2026-11-11T15:01:05.000Z" },
  { id: "n1", rol: "sistema", texto: "Carlos R. (asesor) tomó el caso · 10:02", cards: [], ts: "2026-11-11T15:02:00.000Z", evento: "toma" },
  { id: "a1", rol: "asesor", texto: "Hola, soy Carlos", cards: [], ts: "2026-11-11T15:03:00.000Z", autor: "Carlos R." },
];

test("construirAuditoria: autor, hora, motor, herramientas y veredicto del Guardián", () => {
  const e = construirAuditoria(mensajes, [turno, turnoGemini]);
  expect(e.map((x) => x.autor)).toEqual(["IA", "Cliente", "IA", "Sistema", "Asesor"]);
  expect(e[0]).toMatchObject({
    motor: "reglas",
    herramientas: ["consultar_contexto_vehiculo", "verificar_stock_y_precio"],
    guardian: { entrada: "Permitió", salida: "Permitió" },
    tarjetas: ["bloqueo"],
  });
  expect(e[2]).toMatchObject({ motor: "Gemini", herramientas: [], guardian: { entrada: "Escaló a un asesor (sintoma_critico)" } });
  expect(e[4]).toMatchObject({ humano: true, nombre: "Carlos R.", texto: "Hola, soy Carlos" });
  expect(e[1].humano).toBeUndefined();
  expect(e[1].motor).toBeUndefined();
});

test("construirAuditoria: con la IA activa, un turno que resolvió el motor de reglas (ADR 0009) se audita como reglas", () => {
  const ruta = (id: string, r: "reglas" | "ia"): TraceEvent => ({ ...ev(id, "llm", "planner.ruta"), payload: { ruta: r, motivo: "x" } });
  const porReglas = { ...turnoGemini, turnId: "t1", trace: [ruta("r1", "reglas")] } as AgentTurn;
  const porIa = { ...turnoGemini, turnId: "t2", trace: [ruta("r2", "ia")] } as AgentTurn;
  const e = construirAuditoria(mensajes, [porReglas, porIa]);
  expect(e[0].motor).toBe("reglas");
  expect(e[2].motor).toBe("Gemini");
});

test("construirAuditoria: un turno con la IA activa que resolvió el Guardián sin planner (sin evento de ruta) no se atribuye a Gemini", () => {
  const sinPlanner = { ...turnoGemini, trace: [] } as unknown as AgentTurn;
  expect(construirAuditoria(mensajes, [turno, sinPlanner])[2].motor).toBe("reglas");
});

test("la línea de tiempo muestra hora, autor, detalles de la IA y la marca «humano» del asesor", () => {
  render(<AuditTimeline scenarioId="sintoma_critico" cliente="Andrés F." messages={mensajes} turns={[turno, turnoGemini]} />);
  const items = within(screen.getByRole("list", { name: "Línea de tiempo" })).getAllByTestId("auditoria-entrada");
  expect(items).toHaveLength(5);
  expect(items[0].textContent).toContain(formatHoraReloj("2026-11-11T15:00:00.000Z"));
  expect(items[0].textContent).toContain("IA");
  expect(items[0].textContent).toContain("Motor");
  expect(items[0].textContent).toContain("Reglas");
  expect(items[0].textContent).toContain("consultar_contexto_vehiculo, verificar_stock_y_precio");
  expect(items[0].textContent).toContain("Permitió");
  expect(items[2].textContent).toContain("Gemini");
  expect(items[4].textContent).toContain("humano · Carlos R.");
  expect(items[4].textContent).not.toContain("Motor");
});

test("«Descargar auditoría (JSON)» genera un archivo con todas las entradas, sin dependencias", async () => {
  let blob: Blob | undefined;
  const crear = vi.fn((b: Blob) => {
    blob = b;
    return "blob:auditoria";
  });
  const originales = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };
  URL.createObjectURL = crear;
  URL.revokeObjectURL = vi.fn();
  const descargas: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    descargas.push(`${this.download}|${this.href}`);
  });
  try {
    render(<AuditTimeline scenarioId="sintoma_critico" cliente="Andrés F." messages={mensajes} turns={[turno, turnoGemini]} />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar auditoría (JSON)" }));
    expect(descargas).toEqual(["auditoria-sintoma_critico.json|blob:auditoria"]);
    expect(blob?.type).toBe("application/json");
    const datos = JSON.parse(await blob!.text());
    expect(datos.cliente).toBe("Andrés F.");
    expect(datos.entradas).toHaveLength(5);
    expect(datos.entradas[4]).toMatchObject({ autor: "Asesor", humano: true, nombre: "Carlos R." });
  } finally {
    URL.createObjectURL = originales.crear;
    URL.revokeObjectURL = originales.revocar;
  }
});

test("sin cliente elegido: lo explica y no deja descargar", () => {
  render(<AuditTimeline scenarioId={null} messages={[]} turns={[]} />);
  expect(screen.getByText("Elija un cliente para ver su auditoría.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Descargar auditoría (JSON)" }) as HTMLButtonElement).disabled).toBe(true);
});
