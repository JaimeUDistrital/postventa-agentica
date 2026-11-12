import { describe, expect, it, vi } from "vitest";
import type { AgentState, HandoffReason, ToolName, UserAction } from "@/core/contracts";
import type { Planner, PlannerInput, PlannerResult, PlannerStep } from "@/core/ports";
import { encodeQuoteId } from "@/core/tools";
import { createPlannerHibrido, elegirRuta } from "./planner-hibrido";

const QUOTE = encodeQuoteId({ vehicleId: "veh-01", hitoKm: 20_000, extras: [], descuentoPct: 0 });
const TODAS: ToolName[] = [
  "consultar_contexto_vehiculo",
  "verificar_stock_y_precio",
  "agendar_bahia_taller",
  "cotizar_aliados_seguros",
  "escalar_asesor_humano",
];
const TEXTO_SEGUROS = "Estas son las opciones de nuestras aseguradoras aliadas. Usted decide si le interesa alguna.";

interface Opciones {
  message?: string;
  tipo?: "inicio" | "mensaje" | "accion";
  accion?: UserAction;
  state?: AgentState;
  quoteId?: string | null;
  agenteDijo?: string;
  iteration?: number;
}

function entrada(o: Opciones = {}): PlannerInput {
  const message = o.message ?? "";
  return {
    request: {
      sessionId: "hib-1",
      scenarioId: "feliz",
      tipo: o.tipo ?? (o.accion ? "accion" : "mensaje"),
      message,
      ...(o.accion ? { accion: o.accion } : {}),
    },
    maskedMessage: message,
    session: {
      sessionId: "hib-1",
      scenarioId: "feliz",
      vehicleId: "veh-01",
      state: o.state ?? "COTIZACION",
      turnos: 2,
      intentosBloqueados: 0,
      quoteId: o.quoteId === undefined ? QUOTE : o.quoteId,
      bookingId: null,
      ventaCruzada: "pendiente",
      casoAbiertoId: null,
      historial: o.agenteDijo ? [{ rol: "agente", texto: o.agenteDijo }] : [],
    },
    context: null,
    toolResults: [],
    allowedTools: [...TODAS],
    iteration: o.iteration ?? 0,
  };
}

const responder = (over: Partial<Extract<PlannerStep, { kind: "final" }>> = {}): PlannerStep => ({
  kind: "final",
  text: "El mantenimiento de 20.000 km incluye cambio de aceite, filtros y revisión general.",
  nextState: "CONFIRMACION",
  showCards: ["seguro", "cotizacion"],
  ...over,
});

function iaFalsa(step: PlannerStep = responder(), extra: Partial<PlannerResult> = {}) {
  const next = vi.fn(async (_input: PlannerInput): Promise<PlannerResult> => ({ step, ...extra }));
  const planner: Planner = { mode: "llm", model: "gemini-falso", next };
  return { planner, next };
}

const eventoRuta = (r: PlannerResult) => r.trace?.find((e) => e.name === "planner.ruta");

describe("elegirRuta", () => {
  it.each<[string, Opciones, "reglas" | "ia"]>([
    ["aviso inicial", { tipo: "inicio" }, "reglas"],
    ["botón de la tarjeta", { accion: "aceptar_mantenimiento" }, "reglas"],
    ["intención conocida (agendar)", { message: "quiero agendar la cita" }, "reglas"],
    ["pide un asesor", { message: "quiero hablar con un asesor" }, "reglas"],
    ["caso en manos de un asesor", { message: "¿qué incluye?", state: "HANDOFF" }, "reglas"],
    ["cita confirmada", { message: "¿qué incluye?", state: "CERRADO" }, "reglas"],
    ["aún sin cotización", { message: "¿qué incluye?", quoteId: null }, "reglas"],
    ["mensaje vacío", { message: "   " }, "reglas"],
    ["elige un seguro ya mostrado", { message: "la 2", agenteDijo: TEXTO_SEGUROS }, "reglas"],
    ["pregunta abierta tras la cotización", { message: "¿Tienen sala de espera con wifi?" }, "ia"],
    // QA en vivo: Gemini inventaba qué incluye y cuánto dura; ahora lo responden las reglas con el tarifario.
    ["«¿qué le hacen al carro?» (detalle del tarifario)", { message: "¿qué le hacen al carro en ese mantenimiento?" }, "reglas"],
    ["«¿cuánto tiempo se demora?»", { message: "¿Cuánto tiempo se demora el servicio?" }, "reglas"],
    ["«¿cuánto se demora?»", { message: "¿cuánto se demora?" }, "reglas"],
    ["«¿cuánto dura?»", { message: "¿Cuánto dura el mantenimiento?" }, "reglas"],
    ["«¿cuánto cuesta?» sigue siendo precio", { message: "¿cuánto cuesta?" }, "reglas"],
    ["«¿cuánto me costó?» sigue siendo precio", { message: "¿cuánto me costó al final?" }, "reglas"],
    ["saludo tras la cotización", { message: "hola" }, "ia"],
  ])("%s → %s", (_n, o, ruta) => {
    expect(elegirRuta(entrada(o)).ruta).toBe(ruta);
  });
});

describe("createPlannerHibrido", () => {
  it("ruta reglas: no llama a la IA y responde el motor de reglas (botón Agendar → agendar_bahia_taller)", async () => {
    const ia = iaFalsa();
    const r = await createPlannerHibrido(ia.planner).next(entrada({ accion: "aceptar_mantenimiento" }));
    expect(ia.next).not.toHaveBeenCalled();
    expect(r.step).toMatchObject({ kind: "tool_calls", calls: [{ tool: "agendar_bahia_taller" }] });
    expect(eventoRuta(r)?.payload).toMatchObject({ ruta: "reglas" });
  });

  it("se presenta como IA (el motor híbrido está activo) con el modelo de la IA", () => {
    const h = createPlannerHibrido(iaFalsa().planner);
    expect(h.mode).toBe("llm");
    expect(h.model).toBe("gemini-falso");
  });

  it("ruta IA: solo le ofrece herramientas de consulta", async () => {
    const ia = iaFalsa();
    await createPlannerHibrido(ia.planner).next(entrada({ message: "¿Tienen sala de espera?" }));
    expect(ia.next).toHaveBeenCalledTimes(1);
    expect(ia.next.mock.calls[0][0].allowedTools).toEqual(["consultar_contexto_vehiculo"]);
  });

  it("ruta IA: responde en texto, sin tarjetas y sin mover el estado", async () => {
    const r = await createPlannerHibrido(iaFalsa().planner).next(entrada({ message: "¿Tienen sala de espera?" }));
    expect(r.step).toEqual({
      kind: "final",
      text: "El mantenimiento de 20.000 km incluye cambio de aceite, filtros y revisión general.",
      nextState: "COTIZACION",
      showCards: [],
    });
    expect(eventoRuta(r)?.payload).toMatchObject({ ruta: "ia" });
  });

  // no_resuelto lo decide el motor de reglas (2 mensajes seguidos sin entender, ADR 0008), no la IA al primer intento.
  it.each<HandoffReason>(["sin_stock", "seguro", "adversarial", "no_resuelto"])(
    "ruta IA: un pase a humano con motivo «%s» no le corresponde; se descarta y responden las reglas",
    async (motivo) => {
      const ia = iaFalsa(responder({ text: "Un asesor le contactará.", handoff: { motivo, prioridad: "media", resumen: "x" } }));
      const r = await createPlannerHibrido(ia.planner).next(entrada({ message: "hola" }));
      expect(r.step.kind).toBe("final");
      const final = r.step as Extract<PlannerStep, { kind: "final" }>;
      expect(final.handoff).toBeUndefined();
      expect(final.text).toContain("«asesor»");
      expect(r.trace?.some((e) => e.name === "ia.pase_descartado" && e.status === "blocked")).toBe(true);
    },
  );

  it.each<HandoffReason>(["sintoma_critico", "cliente_molesto"])(
    "ruta IA: puede pasar a humano por «%s»",
    async (motivo) => {
      const handoff = { motivo, prioridad: "alta" as const, resumen: "La IA pide un asesor" };
      const r = await createPlannerHibrido(iaFalsa(responder({ handoff })).planner).next(entrada({ message: "hola" }));
      expect(r.step).toMatchObject({ kind: "final", handoff });
    },
  );

  it("ruta IA: las propuestas de herramientas de consulta pasan tal cual", async () => {
    const paso: PlannerStep = { kind: "tool_calls", rationale: "contexto", calls: [{ id: "c1", tool: "consultar_contexto_vehiculo", args: { vehicleId: "veh-01" } }] };
    const r = await createPlannerHibrido(iaFalsa(paso).planner).next(entrada({ message: "hola" }));
    expect(r.step).toEqual(paso);
  });

  it("ruta IA: si la IA propone agendar o cotizar igualmente, se descarta (defensa propia) y responden las reglas", async () => {
    const paso: PlannerStep = {
      kind: "tool_calls",
      rationale: "x",
      calls: [
        { id: "c1", tool: "agendar_bahia_taller", args: {} },
        { id: "c2", tool: "verificar_stock_y_precio", args: {} },
      ],
    };
    const r = await createPlannerHibrido(iaFalsa(paso).planner).next(entrada({ message: "hola" }));
    expect(r.step.kind).toBe("final");
    expect((r.step as Extract<PlannerStep, { kind: "final" }>).text).toContain("«asesor»");
    const descartes = r.trace?.filter((e) => e.name === "ia.herramienta_descartada" && e.status === "blocked") ?? [];
    expect(descartes.map((e) => e.payload?.tool)).toEqual(["agendar_bahia_taller", "verificar_stock_y_precio"]);
  });

  it("ruta IA: una consulta ya hecha en este turno no se vuelve a ofrecer (QA en vivo: Gemini la repetía 4 veces)", async () => {
    const ia = iaFalsa();
    const yaConsultado: PlannerInput = {
      ...entrada({ message: "hola", iteration: 1 }),
      toolResults: [{ tool: "consultar_contexto_vehiculo", ok: true, output: {}, trace: [] } as unknown as PlannerInput["toolResults"][number]],
    };
    await createPlannerHibrido(ia.planner).next(yaConsultado);
    expect(ia.next.mock.calls[0][0].allowedTools).toEqual([]);
  });

  it("ruta IA: si la IA repite una consulta ya hecha, se descarta", async () => {
    const paso: PlannerStep = { kind: "tool_calls", rationale: "x", calls: [{ id: "c1", tool: "consultar_contexto_vehiculo", args: { vehicleId: "veh-01" } }] };
    const yaConsultado: PlannerInput = {
      ...entrada({ message: "hola", iteration: 1 }),
      toolResults: [{ tool: "consultar_contexto_vehiculo", ok: true, output: {}, trace: [] } as unknown as PlannerInput["toolResults"][number]],
    };
    const r = await createPlannerHibrido(iaFalsa(paso).planner).next(yaConsultado);
    expect(r.step.kind).toBe("final");
    expect(r.trace?.some((e) => e.name === "ia.herramienta_descartada")).toBe(true);
  });

  it.each([
    ["duración inventada", "El servicio toma unas cuatro horas en el taller."],
    ["duración con cifra", "Se demora 3 horas aproximadamente."],
    ["precio inventado", "Eso le cuesta $ 200.000 adicionales."],
    ["precio en pesos", "Son 150.000 pesos más."],
  ])("ruta IA: %s se reemplaza por un texto seguro (guardarraíl de datos no verificados)", async (_n, texto) => {
    const r = await createPlannerHibrido(iaFalsa(responder({ text: texto })).planner).next(entrada({ message: "hola" }));
    const final = r.step as Extract<PlannerStep, { kind: "final" }>;
    expect(final.text).not.toBe(texto);
    expect(final.text).toContain("no lo tengo confirmado");
    expect(r.trace?.some((e) => e.name === "ia.dato_no_verificado" && e.status === "blocked")).toBe(true);
  });

  it("ruta IA: un texto sin cifras de duración ni precio pasa tal cual", async () => {
    const texto = "Sí, tenemos sala de espera. ¿Le ayudo a agendar su mantenimiento de 30.000 km?";
    const r = await createPlannerHibrido(iaFalsa(responder({ text: texto })).planner).next(entrada({ message: "hola" }));
    expect((r.step as Extract<PlannerStep, { kind: "final" }>).text).toBe(texto);
  });

  it("ruta IA: de una mezcla, solo sigue la herramienta de consulta", async () => {
    const consulta = { id: "c2", tool: "consultar_contexto_vehiculo" as const, args: { vehicleId: "veh-01" } };
    const paso: PlannerStep = { kind: "tool_calls", rationale: "x", calls: [{ id: "c1", tool: "cotizar_aliados_seguros", args: {} }, consulta] };
    const r = await createPlannerHibrido(iaFalsa(paso).planner).next(entrada({ message: "hola" }));
    expect(r.step).toEqual({ ...paso, calls: [consulta] });
  });

  it("si la IA cae al respaldo, se conserva la marca fallback", async () => {
    const r = await createPlannerHibrido(iaFalsa(responder(), { fallback: true }).planner).next(entrada({ message: "hola" }));
    expect(r.fallback).toBe(true);
  });

  it("la respuesta del respaldo (motor de reglas) se respeta tal cual: su pase no_resuelto no se descarta (QA local)", async () => {
    const handoff = { motivo: "no_resuelto" as const, prioridad: "media" as const, resumen: "2 mensajes sin entender" };
    const r = await createPlannerHibrido(iaFalsa(responder({ handoff }), { fallback: true }).planner).next(entrada({ message: "hola" }));
    expect(r.fallback).toBe(true);
    expect(r.step).toMatchObject({ kind: "final", handoff });
    expect(r.trace?.some((e) => e.name === "ia.pase_descartado")).toBe(false);
  });

  it("el evento de ruta sale solo en la primera iteración del turno", async () => {
    const h = createPlannerHibrido(iaFalsa().planner);
    expect(eventoRuta(await h.next(entrada({ message: "hola", iteration: 0 })))).toBeDefined();
    expect(eventoRuta(await h.next(entrada({ message: "hola", iteration: 1 })))).toBeUndefined();
  });
});
