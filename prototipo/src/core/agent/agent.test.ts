import { describe, expect, it } from "vitest";
import type { AgentRequest, AgentTurn, ScenarioId, ToolName, TraceEvent } from "@/core/contracts";
import { DEMO_NOW } from "@/core/config";
import { createMockPorts } from "@/core/adapters/mock";
import { fixtures } from "@/core/data";
import type { Planner, PlannerInput, PlannerResult } from "@/core/ports";
import { SesionInvalidaError, createAgent, plannerDeterminista } from "./index";

const SECRET = "secreto-de-prueba-0123456789abcdef";

/** Agente con puertos nuevos en cada turno, como el runTurn por defecto. */
const agente = (planner: Planner = plannerDeterminista) => ({
  runTurn: (req: AgentRequest) =>
    createAgent({ ports: createMockPorts(fixtures), planner, now: DEMO_NOW, secret: SECRET }).runTurn(req),
});

type Paso = Partial<Omit<AgentRequest, "sessionId" | "scenarioId" | "stateToken">>;

async function conversar(
  scenarioId: ScenarioId,
  pasos: Paso[],
  planner: Planner = plannerDeterminista,
): Promise<AgentTurn[]> {
  const a = agente(planner);
  const turnos: AgentTurn[] = [];
  let stateToken: string | undefined;
  for (const p of pasos) {
    const t = await a.runTurn({
      sessionId: `ses-${scenarioId}`,
      scenarioId,
      tipo: "mensaje",
      message: "",
      ...p,
      stateToken,
    });
    stateToken = t.stateToken;
    turnos.push(t);
  }
  return turnos;
}

const toolsLlamadas = (t: AgentTurn): string[] =>
  t.trace.filter((e) => e.kind === "tool_call").map((e) => e.name);
const tipos = (t: AgentTurn) => t.reply.cards.map((c) => c.type);
const guion = (id: ScenarioId) => fixtures.scenarios.find((s) => s.id === id)!.mensajesGuion;
const NEGOCIO: ToolName[] = [
  "consultar_contexto_vehiculo",
  "verificar_stock_y_precio",
  "agendar_bahia_taller",
  "cotizar_aliados_seguros",
];

describe("escenario feliz", () => {
  it("inicio → alerta de km + cotización del tarifario (consultar + verificar)", async () => {
    const [t] = await conversar("feliz", [{ tipo: "inicio" }]);
    expect(toolsLlamadas(t)).toEqual(["consultar_contexto_vehiculo", "verificar_stock_y_precio"]);
    expect(tipos(t)).toEqual(["alerta_km", "cotizacion"]);
    expect(t.state).toBe("COTIZACION");
    expect(t.mode).toBe("deterministic");
    const cot = t.reply.cards.find((c) => c.type === "cotizacion");
    expect(cot?.type === "cotizacion" && cot.quote.hitoKm).toBe(30000);
    expect(t.guardrail.salida?.allow).toBe(true);
  });

  it("guion completo → cotización con venta cruzada y reserva confirmada (CERRADO)", async () => {
    const [m1, m2, m3] = guion("feliz");
    const turnos = await conversar("feliz", [
      { tipo: "inicio" },
      { message: m1 },
      { message: m2 },
      { message: m3 },
    ]);
    const [, precio, cruzada, cierre] = turnos;
    expect(tipos(precio)).toContain("cotizacion");

    expect(cruzada.state).toBe("VENTA_CRUZADA");
    expect(toolsLlamadas(cruzada)).toContain("verificar_stock_y_precio");
    const cot = cruzada.reply.cards.find((c) => c.type === "cotizacion");
    if (cot?.type !== "cotizacion") throw new Error("falta cotización");
    expect(cot.quote.id).toContain("VC-PAS-01");
    expect(cot.quote.items.some((i) => i.sku === "PAS-FRE-UNI")).toBe(true);

    expect(cierre.state).toBe("CERRADO");
    expect(toolsLlamadas(cierre)).toContain("agendar_bahia_taller");
    const res = cierre.reply.cards.find((c) => c.type === "reserva");
    if (res?.type !== "reserva") throw new Error("falta reserva");
    expect(res.booking.estado).toBe("confirmada");
    expect(res.booking.quoteId).toBe(cot.quote.id);
    expect(cierre.memory.postventa.reservaId).toBe(res.booking.id);
    expect(cierre.memory.postventa.turnos).toBe(4);
    expect(cierre.handoff).toBeUndefined();
  });

  it("con botones: agregar_venta_cruzada → aceptar_mantenimiento (hold) → confirmar_reserva", async () => {
    const [, cruzada, hold, cierre] = await conversar("feliz", [
      { tipo: "inicio" },
      { tipo: "accion", accion: "agregar_venta_cruzada" },
      { tipo: "accion", accion: "aceptar_mantenimiento" },
      { tipo: "accion", accion: "confirmar_reserva" },
    ]);
    expect(cruzada.state).toBe("VENTA_CRUZADA");
    expect(hold.state).toBe("CONFIRMACION");
    const h = hold.reply.cards.find((c) => c.type === "reserva");
    expect(h?.type === "reserva" && h.booking.estado).toBe("reservada");
    expect(cierre.state).toBe("CERRADO");
    const policy = cierre.trace.find((e) => e.kind === "policy" && e.name === "politica_reservar_bahia");
    expect(policy?.status).toBe("ok");
  });

  it("seguros por texto → tarjeta seguro desde la herramienta de aseguradoras", async () => {
    const [, t] = await conversar("feliz", [{ tipo: "inicio" }, { message: "¿Y el SOAT? quiero ver seguros" }]);
    expect(toolsLlamadas(t)).toEqual(["cotizar_aliados_seguros"]);
    expect(tipos(t)).toEqual(["seguro"]);
  });

  it("pedir un asesor → HANDOFF cliente_molesto", async () => {
    const [, t] = await conversar("feliz", [{ tipo: "inicio" }, { message: "Estoy molesto, quiero hablar con un asesor humano" }]);
    expect(t.state).toBe("HANDOFF");
    expect(t.handoff?.motivo).toBe("cliente_molesto");
    expect(toolsLlamadas(t)).toContain("escalar_asesor_humano");
  });
});

describe("escenario sintoma_critico", () => {
  it("el mensaje del guion → HANDOFF prioridad alta, resumen del Copiloto, sin reserva", async () => {
    const [, t] = await conversar("sintoma_critico", [{ tipo: "inicio" }, { message: guion("sintoma_critico")[0] }]);
    expect(t.state).toBe("HANDOFF");
    expect(t.guardrail.entrada.action).toBe("escalar");
    expect(toolsLlamadas(t)).toEqual(["escalar_asesor_humano"]);
    expect(tipos(t)).toEqual(["handoff"]);
    expect(t.handoff?.motivo).toBe("sintoma_critico");
    expect(t.handoff?.prioridad).toBe("alta");
    expect(t.handoff?.contexto.sintomas.length).toBeGreaterThan(0);
    expect(t.handoff?.resumen).toMatch(/Motivo/);
    expect(t.handoff?.resumen).toMatch(/Toyota Corolla Cross/);
    expect(t.handoff?.resumen).toMatch(/Siguiente paso/);
    expect(t.memory.copiloto.casoAbiertoId).toBe(t.handoff?.id);
    expect(t.trace.some((e) => e.kind === "handoff")).toBe(true);
  });

  it("tras el HANDOFF, una tool no permitida en ese estado no se ejecuta", async () => {
    const propone: Planner = {
      mode: "deterministic",
      next: async (i: PlannerInput): Promise<PlannerResult> =>
        i.iteration === 0 && i.request.tipo === "mensaje" && i.session.state === "HANDOFF"
          ? { step: { kind: "tool_calls", rationale: "x", calls: [{ id: "c1", tool: "verificar_stock_y_precio", args: { vehicleId: "veh-02", hitoKm: 40000 } }] } }
          : plannerDeterminista.next(i),
    };
    const [, , t] = await conversar(
      "sintoma_critico",
      [{ tipo: "inicio" }, { message: guion("sintoma_critico")[0] }, { message: "ok, gracias" }],
      propone,
    );
    expect(toolsLlamadas(t)).not.toContain("verificar_stock_y_precio");
    expect(t.trace.some((e) => e.kind === "policy" && e.status === "blocked")).toBe(true);
  });
});

describe("escenario sin_stock", () => {
  it("al agendar → alternativas tras la reposición + caso sin_stock prioridad media", async () => {
    const [, t] = await conversar("sin_stock", [{ tipo: "inicio" }, { message: guion("sin_stock")[0] }]);
    expect(toolsLlamadas(t)).toContain("agendar_bahia_taller");
    expect(toolsLlamadas(t)).toContain("escalar_asesor_humano");
    const alt = t.reply.cards.find((c) => c.type === "alternativas");
    if (alt?.type !== "alternativas") throw new Error("faltan alternativas");
    expect(alt.slots.length).toBeGreaterThan(0);
    for (const s of alt.slots) expect(s.inicio > "2026-11-20").toBe(true);
    expect(tipos(t)).not.toContain("reserva");
    expect(t.handoff?.motivo).toBe("sin_stock");
    expect(t.handoff?.prioridad).toBe("media");
    expect(t.state).toBe("HANDOFF");
  });
});

describe("escenario adversarial", () => {
  it("el mensaje del guion → BLOQUEADO + alerta, sin tools de negocio, caso de revisión", async () => {
    const [, t] = await conversar("adversarial", [{ tipo: "inicio" }, { message: guion("adversarial")[0] }]);
    expect(t.state).toBe("BLOQUEADO");
    expect(t.guardrail.entrada.categorias).toEqual(expect.arrayContaining(["inyeccion", "fraude"]));
    expect(tipos(t)).toContain("bloqueo");
    for (const tool of NEGOCIO) expect(toolsLlamadas(t)).not.toContain(tool);
    expect(t.memory.guardian.intentosBloqueados).toBe(1);
    expect(t.memory.guardian.alertas.join(" ")).toMatch(/inyeccion|fraude/);
    expect(t.handoff?.motivo).toBe("adversarial");
    expect(t.handoff?.prioridad).toBe("media");
  });

  it("al superar el límite de intentos, incluso un mensaje normal queda bloqueado", async () => {
    const msg = guion("adversarial")[0];
    const turnos = await conversar("adversarial", [{ tipo: "inicio" }, { message: msg }, { message: msg }, { message: "¿Cuánto cuesta?" }]);
    const ultimo = turnos[3];
    expect(ultimo.state).toBe("BLOQUEADO");
    expect(ultimo.guardrail.entrada.categorias).toContain("limite_intentos");
    for (const tool of NEGOCIO) expect(toolsLlamadas(ultimo)).not.toContain(tool);
  });
});

describe("escenario sin_consentimiento", () => {
  it("inicio → el Proactivo no contacta: sin tools, traza del gate y texto para el jurado", async () => {
    const [t] = await conversar("sin_consentimiento", [{ tipo: "inicio" }]);
    expect(toolsLlamadas(t)).toEqual([]);
    expect(t.state).toBe("TRIGGER");
    expect(t.reply.text).toContain("Sin autorización de contacto por WhatsApp: no se envía mensaje");
    expect(t.trace.some((e) => e.name === "gate_consentimiento" && e.status === "blocked")).toBe(true);
    expect(t.memory.proactivo.optInWhatsapp).toBe(false);
    expect(t.memory.guardian.intentosBloqueados).toBe(0);
  });
});

describe("política y Guardián frente a un planner falso", () => {
  const plannerQueAgenda: Planner = {
    mode: "llm",
    next: async (i) =>
      i.iteration === 0
        ? {
            step: {
              kind: "tool_calls",
              rationale: "reservar ya",
              calls: [
                {
                  id: "c1",
                  tool: "agendar_bahia_taller",
                  args: { vehicleId: "veh-01", quoteId: "q_veh-01_30000__0", idempotencyKey: "clave-falsa-123", confirmadoPorCliente: true },
                },
              ],
            },
          }
        : { step: { kind: "final", text: "Listo.", nextState: "CERRADO", showCards: ["reserva"] } },
  };

  it("agendar sin confirmación del cliente → bloqueado por la política y no ejecutado", async () => {
    const [, t] = await conversar("feliz", [{ tipo: "inicio" }, { message: "hola, buenas tardes" }], plannerQueAgenda);
    expect(toolsLlamadas(t)).not.toContain("agendar_bahia_taller");
    const pol = t.trace.find((e) => e.name === "politica_reservar_bahia");
    expect(pol?.status).toBe("blocked");
    expect(tipos(t)).not.toContain("reserva");
    expect(t.state).not.toBe("CERRADO");
  });

  it("una tool inexistente o no permitida → evento policy blocked, no se ejecuta", async () => {
    const inventa: Planner = {
      mode: "llm",
      next: async (i) =>
        i.iteration === 0
          ? { step: { kind: "tool_calls", rationale: "x", calls: [{ id: "c1", tool: "borrar_crm" as unknown as ToolName, args: {} }] } }
          : { step: { kind: "final", text: "Le ayudo con su mantenimiento.", nextState: "COTIZACION", showCards: ["cotizacion"] } },
    };
    const [, t] = await conversar("feliz", [{ tipo: "inicio" }, { message: "hola" }], inventa);
    expect(toolsLlamadas(t)).toEqual([]);
    expect(t.trace.some((e) => e.kind === "policy" && e.status === "blocked")).toBe(true);
    // Pidió tarjeta de cotización sin resultado verificado: no se muestra.
    expect(tipos(t)).not.toContain("cotizacion");
    expect(t.mode).toBe("llm");
  });

  it("respuesta que promete garantía → salida bloqueada, texto seguro y escalamiento", async () => {
    const promete: Planner = {
      mode: "llm",
      next: async () => ({
        step: { kind: "final", text: "Tranquilo, aprobamos su garantía y la garantía lo cubre todo.", nextState: "COTIZACION", showCards: [] },
      }),
    };
    const [, t] = await conversar("feliz", [{ tipo: "inicio" }, { message: "¿me cubre la garantía?" }], promete);
    expect(t.guardrail.salida?.allow).toBe(false);
    expect(t.reply.text).not.toMatch(/aprobamos/i);
    expect(t.state).toBe("HANDOFF");
    expect(t.handoff).toBeDefined();
  });

  it("si el planner LLM cae al respaldo, el modo es deterministic", async () => {
    const conRespaldo: Planner = {
      mode: "llm",
      next: async (i) => ({ ...(await plannerDeterminista.next(i)), fallback: true }),
    };
    const [t] = await conversar("feliz", [{ tipo: "inicio" }], conRespaldo);
    expect(t.mode).toBe("deterministic");
  });
});

describe("sesión y privacidad", () => {
  it("token alterado → SesionInvalidaError", async () => {
    const [t] = await conversar("feliz", [{ tipo: "inicio" }]);
    const a = agente();
    await expect(
      a.runTurn({ sessionId: "ses-feliz", scenarioId: "feliz", tipo: "mensaje", message: "hola", stateToken: `x${t.stateToken}` }),
    ).rejects.toBeInstanceOf(SesionInvalidaError);
    await expect(
      a.runTurn({ sessionId: "ses-feliz", scenarioId: "feliz", tipo: "mensaje", message: "hola" }),
    ).rejects.toBeInstanceOf(SesionInvalidaError);
  });

  it("cero PII del fixture (cédula, celular, email) en traza, handoff ni memoria", async () => {
    const o = fixtures.owners.find((x) => x.id === "own-01")!;
    const msg = `Mi cédula es ${o.cedula}, celular ${o.celular} y correo ${o.email}. ¿Cuánto cuesta?`;
    const turnos = [
      ...(await conversar("feliz", [{ tipo: "inicio" }, { message: msg }, { message: `Quiero un asesor, ${o.email}` }])),
      ...(await conversar("sintoma_critico", [{ tipo: "inicio" }, { message: `${guion("sintoma_critico")[0]} cc ${o.cedula}` }])),
    ];
    const traza: TraceEvent[] = turnos.flatMap((t) => t.trace);
    expect(traza.length).toBeGreaterThan(0);
    for (const t of turnos) {
      const { stateToken: _omit, ...visible } = t;
      const json = JSON.stringify(visible) + Buffer.from(t.stateToken.split(".")[0], "base64url").toString("utf8");
      for (const dato of [o.cedula, o.celular, o.email]) expect(json).not.toContain(dato);
    }
  });

  it("cada turno devuelve un MemorySnapshot completo desde la sesión y el CRM", async () => {
    const [t] = await conversar("feliz", [{ tipo: "inicio" }]);
    expect(t.memory.proactivo.optInWhatsapp).toBe(true);
    expect(t.memory.proactivo.motivoContacto).toMatch(/30000|30\.000/);
    expect(t.memory.postventa.perfilVehiculo.descripcion).toContain("Mazda CX-30");
    expect(t.memory.postventa.perfilVehiculo.proximoHitoKm).toBe(30000);
    expect(t.memory.postventa.historialServicios.length).toBeGreaterThan(0);
    expect(t.memory.postventa.cotizacionId).toMatch(/^q_veh-01_30000/);
    expect(t.trace.some((e) => e.kind === "memory")).toBe(true);
    expect(t.trace.some((e) => e.kind === "state")).toBe(true);
  });
});
