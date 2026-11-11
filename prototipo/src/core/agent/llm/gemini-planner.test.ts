import { describe, expect, it, vi } from "vitest";
import type { GenerateContentParameters } from "@google/genai";
import type { Planner, PlannerInput, PlannerResult } from "@/core/ports";
import { createGeminiPlanner, selectPlanner, type GeminiClientLike, type GeminiResponseLike } from "./index";
import { estimateCostUsd } from "./pricing";
import { PROMPT_VERSION, SYSTEM_PROMPT } from "../prompts";

const CEDULA = "1020304050";
const CELULAR = "3001234567";
const EMAIL = "laura.gomez@correo.com";
const PLACA = "ABC123";

const input: PlannerInput = {
  request: {
    sessionId: "s1",
    scenarioId: "feliz",
    tipo: "mensaje",
    message: `Hola, mi cédula es ${CEDULA}, celular ${CELULAR}, correo ${EMAIL}. Quiero el mantenimiento`,
  },
  maskedMessage: "Hola, mi cédula es [CEDULA], celular [TELEFONO], correo [EMAIL]. Quiero el mantenimiento",
  session: {
    sessionId: "s1",
    scenarioId: "feliz",
    vehicleId: "veh-1",
    state: "CONTACTO",
    turnos: 1,
    intentosBloqueados: 0,
    quoteId: null,
    bookingId: null,
    ventaCruzada: "pendiente",
    casoAbiertoId: null,
    historial: [],
  },
  context: {
    vehicle: {
      id: "veh-1",
      ownerId: "own-1",
      placa: PLACA,
      marca: "Mazda",
      modelo: "CX-30",
      anio: 2023,
      fechaEntrega: "2023-01-10",
      kmUltimoRegistro: 18000,
      fechaUltimoRegistro: "2026-10-01",
      kmPromedioDia: 40,
      garantiaFabricaHasta: "2028-01-10",
      vencimientoSoat: "2027-01-10",
      vencimientoPoliza: null,
    },
    clienteAlias: "Laura G.",
    consentimientos: [],
    contactosUltimos30Dias: 0,
    kmEstimado: 19500,
    proximoHitoKm: 20000,
    diasParaHito: 12,
    enGarantia: true,
    historial: [],
  },
  toolResults: [],
  allowedTools: ["verificar_stock_y_precio", "escalar_asesor_humano"],
  iteration: 0,
};

const fallbackResult: PlannerResult = {
  step: { kind: "final", text: "respaldo", nextState: "CONTACTO", showCards: [] },
};

function fakeFallback(): Planner & { next: ReturnType<typeof vi.fn> } {
  return { mode: "deterministic", next: vi.fn(async () => fallbackResult) };
}

type Gen = (p: GenerateContentParameters) => Promise<GeminiResponseLike>;
function fakeClient(gen: Gen) {
  const generateContent = vi.fn(gen);
  const client: GeminiClientLike = { models: { generateContent } };
  return { client, generateContent };
}

const usage = { promptTokenCount: 1000, candidatesTokenCount: 200 };
const NOW = "2026-11-12T09:00";
const mk = (client: GeminiClientLike, fallback: Planner, extra: { model?: string; timeoutMs?: number } = {}) =>
  createGeminiPlanner({ apiKey: "k", model: extra.model ?? "gemini-3.5-flash-lite", client, fallback, now: () => NOW, timeoutMs: extra.timeoutMs });

describe("selectPlanner", () => {
  it("sin GEMINI_API_KEY devuelve el respaldo tal cual y no llama a la red", () => {
    const fb = fakeFallback();
    const { client, generateContent } = fakeClient(async () => ({}));
    expect(selectPlanner({ env: {}, fallback: fb, client })).toBe(fb);
    expect(selectPlanner({ env: { GEMINI_API_KEY: "  " }, fallback: fb, client })).toBe(fb);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("con key usa GEMINI_MODEL, o el modelo por defecto", () => {
    const fb = fakeFallback();
    const { client } = fakeClient(async () => ({}));
    const a = selectPlanner({ env: { GEMINI_API_KEY: "k" }, fallback: fb, client });
    expect(a.mode).toBe("llm");
    expect(a.model).toBe("gemini-3.5-flash-lite");
    const b = selectPlanner({ env: { GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-3.6-flash" }, fallback: fb, client });
    expect(b.model).toBe("gemini-3.6-flash");
  });
});

describe("createGeminiPlanner", () => {
  it("functionCall válido → tool_calls validado, con usage, costo y traza ok", async () => {
    const { client, generateContent } = fakeClient(async () => ({
      functionCalls: [{ id: "c1", name: "verificar_stock_y_precio", args: { vehicleId: "veh-1", hitoKm: 20000 } }],
      usageMetadata: usage,
    }));
    const fb = fakeFallback();
    const r = await mk(client, fb).next(input);
    expect(r.fallback).toBeUndefined();
    expect(r.step.kind).toBe("tool_calls");
    if (r.step.kind !== "tool_calls") return;
    expect(r.step.calls).toHaveLength(1);
    expect(r.step.calls[0]).toMatchObject({ id: "c1", tool: "verificar_stock_y_precio", args: { vehicleId: "veh-1", hitoKm: 20000, extras: [], descuentoPct: 0 } });
    expect(r.usage).toEqual({ inputTokens: 1000, outputTokens: 200, costoUsd: 0.0008 });
    const ev = r.trace?.[0];
    expect(ev).toMatchObject({ kind: "llm", agent: "Postventa", system: "LLM", name: "gemini.generateContent", status: "ok" });
    expect(ev?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(ev?.payload).toMatchObject({ modelo: "gemini-3.5-flash-lite", promptVersion: PROMPT_VERSION, costoUsd: 0.0008, toolCallsPropuestas: ["verificar_stock_y_precio"] });
    expect(ev?.detalle).toBeTruthy();
    expect(fb.next).not.toHaveBeenCalled();
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("solo declara las herramientas permitidas + responder_al_cliente, con system prompt", async () => {
    const { client, generateContent } = fakeClient(async () => ({
      functionCalls: [{ name: "escalar_asesor_humano", args: { vehicleId: "veh-1", motivo: "garantia", prioridad: "media", resumen: "x" } }],
      usageMetadata: usage,
    }));
    await mk(client, fakeFallback()).next(input);
    const req = generateContent.mock.calls[0]![0];
    const tools = req.config?.tools as { functionDeclarations: { name: string; parametersJsonSchema?: Record<string, unknown> }[] }[];
    const names = tools[0]!.functionDeclarations.map((d) => d.name);
    expect(names).toEqual(["verificar_stock_y_precio", "escalar_asesor_humano", "responder_al_cliente"]);
    expect(tools[0]!.functionDeclarations[0]!.parametersJsonSchema).toHaveProperty("properties");
    expect(req.config?.systemInstruction).toBe(SYSTEM_PROMPT);
    expect(req.model).toBe("gemini-3.5-flash-lite");
  });

  it("args inválidos o tool no permitida → se descarta y se registra; el válido pasa", async () => {
    const { client } = fakeClient(async () => ({
      functionCalls: [
        { name: "verificar_stock_y_precio", args: { vehicleId: "veh-1", hitoKm: "veinte mil" } },
        { name: "agendar_bahia_taller", args: { vehicleId: "veh-1", quoteId: "q1", idempotencyKey: "12345678", confirmadoPorCliente: true } },
        { name: "escalar_asesor_humano", args: { vehicleId: "veh-1", motivo: "garantia", prioridad: "media", resumen: "Cliente pide garantía" } },
      ],
      usageMetadata: usage,
    }));
    const fb = fakeFallback();
    const r = await mk(client, fb).next(input);
    expect(r.step.kind).toBe("tool_calls");
    if (r.step.kind !== "tool_calls") return;
    expect(r.step.calls.map((c) => c.tool)).toEqual(["escalar_asesor_humano"]);
    expect(r.trace?.filter((e) => e.status === "blocked")).toHaveLength(2);
    expect(fb.next).not.toHaveBeenCalled();
  });

  it("si no queda nada válido → respaldo con fallback:true y evento llm error", async () => {
    const { client } = fakeClient(async () => ({
      functionCalls: [{ name: "agendar_bahia_taller", args: {} }, { name: "inventada", args: {} }],
      usageMetadata: usage,
    }));
    const fb = fakeFallback();
    const r = await mk(client, fb).next(input);
    expect(fb.next).toHaveBeenCalledWith(input);
    expect(r.fallback).toBe(true);
    expect(r.step).toEqual(fallbackResult.step);
    expect(r.trace?.some((e) => e.kind === "llm" && e.status === "error")).toBe(true);
  });

  it("respuesta de solo texto (sin functionCall) → respaldo", async () => {
    const { client } = fakeClient(async () => ({ text: "hola", usageMetadata: usage }));
    const fb = fakeFallback();
    const r = await mk(client, fb).next(input);
    expect(r.fallback).toBe(true);
    expect(fb.next).toHaveBeenCalledTimes(1);
  });

  it("responder_al_cliente → step final válido, con handoff", async () => {
    const { client } = fakeClient(async () => ({
      functionCalls: [
        {
          name: "responder_al_cliente",
          args: {
            texto: "Voy a escalar su caso con un asesor.",
            siguienteEstado: "HANDOFF",
            mostrarTarjetas: ["cotizacion"],
            handoff: { motivo: "sintoma_critico", prioridad: "alta", resumen: "Frenos con ruido" },
          },
        },
      ],
      usageMetadata: usage,
    }));
    const r = await mk(client, fakeFallback()).next(input);
    expect(r.step).toEqual({
      kind: "final",
      text: "Voy a escalar su caso con un asesor.",
      nextState: "HANDOFF",
      showCards: ["cotizacion"],
      handoff: { motivo: "sintoma_critico", prioridad: "alta", resumen: "Frenos con ruido" },
    });
    expect(r.usage?.inputTokens).toBe(1000);
  });

  it("responder_al_cliente inválido (estado inexistente) → respaldo", async () => {
    const { client } = fakeClient(async () => ({
      functionCalls: [{ name: "responder_al_cliente", args: { texto: "x", siguienteEstado: "VOLAR", mostrarTarjetas: [] } }],
    }));
    const r = await mk(client, fakeFallback()).next(input);
    expect(r.fallback).toBe(true);
  });

  it("excepción: reintenta 1 vez y luego respaldo con fallback:true y evento llm error", async () => {
    const { client, generateContent } = fakeClient(async () => {
      throw new Error("503 unavailable");
    });
    const fb = fakeFallback();
    const r = await mk(client, fb).next(input);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(fb.next).toHaveBeenCalledTimes(1);
    expect(r.fallback).toBe(true);
    expect(r.step).toEqual(fallbackResult.step);
    expect(r.trace).toHaveLength(1);
    expect(r.trace?.[0]).toMatchObject({ kind: "llm", name: "gemini.generateContent", status: "error", system: "LLM" });
  });

  it("timeout: aborta, reintenta 1 vez y luego respaldo", async () => {
    const { client, generateContent } = fakeClient(() => new Promise<GeminiResponseLike>(() => {}));
    const fb = fakeFallback();
    const r = await mk(client, fb, { timeoutMs: 20 }).next(input);
    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(r.fallback).toBe(true);
    expect(r.trace?.[0]?.status).toBe("error");
    expect(String(r.trace?.[0]?.detalle)).toMatch(/tiempo|timeout/i);
  });

  it("el primer intento falla y el segundo funciona → éxito sin respaldo", async () => {
    let n = 0;
    const { client } = fakeClient(async () => {
      if (++n === 1) throw new Error("boom");
      return { functionCalls: [{ name: "escalar_asesor_humano", args: { vehicleId: "veh-1", motivo: "garantia", prioridad: "baja", resumen: "r" } }], usageMetadata: usage };
    });
    const fb = fakeFallback();
    const r = await mk(client, fb).next(input);
    expect(r.fallback).toBeUndefined();
    expect(r.step.kind).toBe("tool_calls");
    expect(fb.next).not.toHaveBeenCalled();
  });

  it("el error no filtra la API key", async () => {
    const { client } = fakeClient(async () => {
      throw new Error("bad key SECRETO-123");
    });
    const r = await createGeminiPlanner({ apiKey: "SECRETO-123", model: "gemini-3.5-flash-lite", client, fallback: fakeFallback(), now: () => NOW }).next(input);
    expect(JSON.stringify(r.trace)).not.toContain("SECRETO-123");
  });

  it("la petición al cliente usa el mensaje enmascarado y no contiene PII del request original", async () => {
    const { client, generateContent } = fakeClient(async () => ({
      functionCalls: [{ name: "escalar_asesor_humano", args: { vehicleId: "veh-1", motivo: "garantia", prioridad: "baja", resumen: "r" } }],
      usageMetadata: usage,
    }));
    await mk(client, fakeFallback()).next(input);
    const sent = JSON.stringify(generateContent.mock.calls[0]![0]);
    for (const pii of [CEDULA, CELULAR, EMAIL, PLACA, "own-1", "Laura"]) expect(sent).not.toContain(pii);
    expect(sent).toContain("[CEDULA]");
    expect(sent).toContain("veh-1");
    expect(sent).toContain("20000");
  });

  it("los resultados de herramientas viajan sin claves sensibles", async () => {
    const { client, generateContent } = fakeClient(async () => ({
      functionCalls: [{ name: "escalar_asesor_humano", args: { vehicleId: "veh-1", motivo: "garantia", prioridad: "baja", resumen: "r" } }],
    }));
    const withResults: PlannerInput = {
      ...input,
      toolResults: [{ tool: "verificar_stock_y_precio", ok: true, output: { todosDisponibles: true, placa: PLACA, owner: { email: EMAIL } }, trace: [] }],
    };
    await mk(client, fakeFallback()).next(withResults);
    const sent = JSON.stringify(generateContent.mock.calls[0]![0]);
    expect(sent).toContain("todosDisponibles");
    expect(sent).not.toContain(PLACA);
    expect(sent).not.toContain(EMAIL);
  });

  it("el planner solo propone: no tiene nada que ejecutar (no llama herramientas)", async () => {
    const { client } = fakeClient(async () => ({
      functionCalls: [{ name: "escalar_asesor_humano", args: { vehicleId: "veh-1", motivo: "garantia", prioridad: "baja", resumen: "r" } }],
    }));
    const p = mk(client, fakeFallback());
    expect(p.mode).toBe("llm");
    const r = await p.next(input);
    expect(r.step.kind).toBe("tool_calls");
  });
});

describe("estimateCostUsd", () => {
  it("flash-lite: 0,30 entrada / 2,50 salida por 1M", () => {
    expect(estimateCostUsd("gemini-3.5-flash-lite", "2026-11-12", 1_000_000, 1_000_000)).toBeCloseTo(2.8, 8);
  });
  it("3.6-flash: 0,75/3,75 hasta 2026-12-31 y 1,50/7,50 desde 2027", () => {
    expect(estimateCostUsd("gemini-3.6-flash", "2026-12-31", 1_000_000, 1_000_000)).toBeCloseTo(4.5, 8);
    expect(estimateCostUsd("gemini-3.6-flash", "2027-01-01", 1_000_000, 1_000_000)).toBeCloseTo(9, 8);
  });
  it("modelo desconocido → 0", () => {
    expect(estimateCostUsd("otro", "2026-11-12", 10, 10)).toBe(0);
  });
});
