import { describe, expect, it, vi } from "vitest";
import type { AgentRequest, AgentTurn, SessionState } from "@/core/contracts";
import type { GeminiClientLike } from "./llm";
import { LIMITES_DEMO, llmHabilitado } from "./acceso";
import { firmarSesion } from "./session";
import { runTurnConEntorno } from "./index";

const SECRET = "secreto-de-prueba-0123456789abcdef";
const CODIGO = "jurado-2026-abcdef";
const BASE = { SESSION_SECRET: SECRET, GEMINI_API_KEY: "clave-falsa-de-prueba" };
const ENV_OK = { ...BASE, DEMO_ACCESS_CODE: CODIGO };
/** Interruptor de emergencia (ADR 0007): vuelve a exigir el código del jurado. */
const CERRADO = { GEMINI_SOLO_CON_CODIGO: "1" };
const ENV_CERRADO = { ...ENV_OK, ...CERRADO };

describe("llmHabilitado", () => {
  it.each([
    // Por defecto (ADR 0007): IA para todos los visitantes si hay clave.
    [{ accessCode: undefined, env: BASE }, true, "publico"],
    [{ accessCode: undefined, env: { ...BASE, GEMINI_SOLO_CON_CODIGO: "0" } }, true, "publico"],
    [{ accessCode: undefined, env: { ...BASE, GEMINI_API_KEY: "" } }, false, "sin_clave"],
    // Con el interruptor de emergencia: código del jurado obligatorio (ADR 0006).
    [{ accessCode: CODIGO, env: ENV_CERRADO }, true, "ok"],
    [{ accessCode: CODIGO, env: { ...ENV_CERRADO, GEMINI_API_KEY: "" } }, false, "sin_clave"],
    [{ accessCode: CODIGO, env: { ...BASE, ...CERRADO } }, false, "sin_codigo_configurado"],
    [{ accessCode: "corto", env: { ...BASE, ...CERRADO, DEMO_ACCESS_CODE: "corto" } }, false, "sin_codigo_configurado"],
    [{ accessCode: undefined, env: ENV_CERRADO }, false, "codigo_ausente"],
    [{ accessCode: "", env: ENV_CERRADO }, false, "codigo_ausente"],
    [{ accessCode: "otro-codigo-largo", env: ENV_CERRADO }, false, "codigo_invalido"],
    [{ accessCode: `${CODIGO}x`, env: ENV_CERRADO }, false, "codigo_invalido"],
  ] as const)("%j → %s/%s", (args, habilitado, motivo) => {
    expect(llmHabilitado(args)).toEqual({ habilitado, motivo });
  });

  it("límites de la demo", () => {
    expect(LIMITES_DEMO).toEqual({ maxTurnosSesion: 20, maxPeticionesPorMinutoIp: 30 });
  });
});

function fakeGemini(): GeminiClientLike & { llamadas: () => number } {
  const generateContent = vi.fn(async () => ({
    functionCalls: [
      { name: "responder_al_cliente", args: { texto: "Hola, soy el planner LLM de prueba.", siguienteEstado: "CONTACTO", mostrarTarjetas: [] } },
    ],
  }));
  return { models: { generateContent }, llamadas: () => generateContent.mock.calls.length };
}

const inicio: AgentRequest = { sessionId: "acc-1", scenarioId: "feliz", tipo: "inicio", message: "" };
const accesoEvt = (t: AgentTurn) => t.trace.find((e) => e.name === "llm.acceso");

describe("runTurnConEntorno · control de acceso al LLM", () => {
  it("por defecto (IA para todos): sin código + clave → planner LLM, sin evento llm.acceso", async () => {
    const client = fakeGemini();
    const t = await runTurnConEntorno(inicio, ENV_OK, client);
    expect(t.mode).toBe("llm");
    expect(client.llamadas()).toBeGreaterThan(0);
    expect(accesoEvt(t)).toBeUndefined();
  });

  it("con interruptor: sin código → determinista, Gemini nunca se invoca y se explica en la traza", async () => {
    const client = fakeGemini();
    const t = await runTurnConEntorno(inicio, ENV_CERRADO, client);
    expect(t.mode).toBe("deterministic");
    expect(client.llamadas()).toBe(0);
    const e = accesoEvt(t);
    expect(e).toMatchObject({ kind: "policy", agent: "Guardián", system: "LLM", status: "ok", payload: { modo: "determinista", motivo: "codigo_ausente" } });
    expect(e?.detalle).toContain("código del jurado");
  });

  it("código incorrecto → determinista + motivo codigo_invalido, sin filtrar el código", async () => {
    const client = fakeGemini();
    const malo = "intento-incorrecto-1";
    const t = await runTurnConEntorno({ ...inicio, accessCode: malo }, ENV_CERRADO, client);
    expect(t.mode).toBe("deterministic");
    expect(client.llamadas()).toBe(0);
    expect(accesoEvt(t)?.payload).toEqual({ modo: "determinista", motivo: "codigo_invalido" });
    const todo = JSON.stringify(t);
    expect(todo).not.toContain(malo);
    expect(todo).not.toContain(CODIGO);
  });

  it("código correcto + clave → planner LLM; el código no aparece en la respuesta", async () => {
    const client = fakeGemini();
    const t = await runTurnConEntorno({ ...inicio, accessCode: CODIGO }, ENV_CERRADO, client);
    expect(t.mode).toBe("llm");
    expect(client.llamadas()).toBeGreaterThan(0);
    expect(accesoEvt(t)).toBeUndefined();
    expect(JSON.stringify(t)).not.toContain(CODIGO);
  });

  it.each([
    ["ausente", { ...BASE, ...CERRADO } as Record<string, string>],
    ["corto", { ...BASE, ...CERRADO, DEMO_ACCESS_CODE: "corto" } as Record<string, string>],
  ])("DEMO_ACCESS_CODE %s → deshabilitado aunque el código coincida", async (_n, env) => {
    const client = fakeGemini();
    const code = env.DEMO_ACCESS_CODE ?? "";
    const t = await runTurnConEntorno({ ...inicio, accessCode: code || CODIGO }, env, client);
    expect(t.mode).toBe("deterministic");
    expect(client.llamadas()).toBe(0);
    expect(accesoEvt(t)?.payload).toEqual({ modo: "determinista", motivo: "sin_codigo_configurado" });
  });

  it("sin GEMINI_API_KEY → determinista sin evento llm.acceso", async () => {
    const client = fakeGemini();
    const t = await runTurnConEntorno({ ...inicio, accessCode: CODIGO }, { ...ENV_OK, GEMINI_API_KEY: "" }, client);
    expect(t.mode).toBe("deterministic");
    expect(client.llamadas()).toBe(0);
    expect(accesoEvt(t)).toBeUndefined();
  });
});

describe("runTurnConEntorno · tope de turnos por sesión", () => {
  const sesion = (turnos: number): SessionState => ({
    sessionId: "acc-tope",
    scenarioId: "feliz",
    vehicleId: "veh-01",
    state: "COTIZACION",
    turnos,
    intentosBloqueados: 0,
    quoteId: null,
    bookingId: null,
    ventaCruzada: "pendiente",
    casoAbiertoId: null,
    historial: [],
  });
  const peticion = (turnos: number): AgentRequest => ({
    sessionId: "acc-tope",
    scenarioId: "feliz",
    tipo: "mensaje",
    message: "Confirmo la cita",
    stateToken: firmarSesion(sesion(turnos), SECRET, Date.now()),
  });

  it("turno 21 → tarjeta bloqueo, sin tools ni planner, evento policy blocked", async () => {
    const client = fakeGemini();
    const t = await runTurnConEntorno({ ...peticion(LIMITES_DEMO.maxTurnosSesion), accessCode: CODIGO }, ENV_OK, client);
    expect(client.llamadas()).toBe(0);
    expect(t.trace.filter((e) => e.kind === "tool_call" || e.kind === "tool_result")).toEqual([]);
    expect(t.reply.text).toContain("límite de 20 turnos");
    expect(t.reply.text).toContain("«Reiniciar»");
    expect(t.reply.cards).toEqual([{ type: "bloqueo", motivo: t.reply.text }]);
    expect(t.state).toBe("COTIZACION");
    expect(t.trace.some((e) => e.kind === "policy" && e.name === "limite_turnos" && e.status === "blocked")).toBe(true);
  });

  it("turno 20 (19 previos) sigue funcionando", async () => {
    const t = await runTurnConEntorno(peticion(LIMITES_DEMO.maxTurnosSesion - 1), ENV_OK, fakeGemini());
    expect(t.reply.cards.some((c) => c.type === "bloqueo")).toBe(false);
    expect(t.trace.some((e) => e.name === "limite_turnos")).toBe(false);
  });
});
