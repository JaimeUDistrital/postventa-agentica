/**
 * Orquestador del turno: Guardián de entrada → (bloqueo | escalamiento | planner + política
 * + herramientas) → tarjetas desde resultados verificados → Guardián de salida → AgentTurn.
 * Toda la traza pasa por la auditoría (PII enmascarada) antes de salir.
 */
import {
  EscalarAsesorOutput,
  ToolName,
  type AgentRequest,
  type AgentState,
  type AgentTurn,
  type GuardrailVerdict,
  type HandoffCase,
  type HandoffReason,
  type MemorySnapshot,
  type Owner,
  type ReplyCard,
  type ScenarioFixture,
  type ServiceRecord,
  type SessionState,
  type ToolResult,
  type Vehicle,
} from "@/core/contracts";
import { llmConfig } from "@/core/config";
import { fixtures } from "@/core/data";
import { crearAuditoria, type Auditoria } from "@/core/audit";
import { autorizarAccion, evaluarEntrada, validarSalida, type AccionPolitica } from "@/core/guardrails";
import type { Planner, PlannerStep, Ports, ToolCall, ToolContext } from "@/core/ports";
import { estimarKm, executeTool, parseQuoteId, type EstimacionKm } from "@/core/tools";
import { agendaDe, construirTarjetas, contextoDe, cotizacionDe, recalcularTotal } from "./cards";
import { resumenCopiloto } from "./copiloto";
import { confirmaReserva, detectarIntencion } from "./intencion";
import { SesionInvalidaError, firmarSesion, verificarSesion } from "./session";
import { evento } from "./trace";

export interface AgentDeps {
  ports: Ports;
  planner: Planner;
  /** Hora fija de la demo para las herramientas (DEMO_NOW). */
  now: string;
  secret: string;
  /** Reloj real para la caducidad del token (ms). */
  clock?: () => number;
  scenarios?: readonly ScenarioFixture[];
}

export interface Agent {
  runTurn(request: AgentRequest): Promise<AgentTurn>;
}

interface Perfil {
  vehicle: Vehicle;
  owner: Owner;
  historial: ServiceRecord[];
  est: EstimacionKm;
  optIn: boolean;
}

interface Resultado {
  state: AgentState;
  text: string;
  cards: ReplyCard[];
  caso?: HandoffCase;
  alertas: string[];
  intentosBloqueados: number;
  toolResults: ToolResult[];
  confirmada: boolean;
  /** true solo si el planner LLM respondió en este turno sin caer al respaldo. */
  llm: boolean;
}

const TODAS = ToolName.options;
const TOOLS_POR_ESTADO: Record<AgentState, readonly ToolName[]> = {
  TRIGGER: TODAS,
  CONTACTO: TODAS,
  COTIZACION: TODAS,
  VENTA_CRUZADA: TODAS,
  CONFIRMACION: TODAS,
  CERRADO: TODAS.filter((t) => t !== "agendar_bahia_taller"),
  HANDOFF: ["consultar_contexto_vehiculo", "escalar_asesor_humano"],
  BLOQUEADO: ["consultar_contexto_vehiculo", "verificar_stock_y_precio", "cotizar_aliados_seguros", "escalar_asesor_humano"],
};

const TEXTO_SIN_CONSENTIMIENTO =
  "Sin autorización de contacto por WhatsApp: no se envía mensaje. El agente Proactivo registra el hito y espera a que el cliente escriba.";
const TEXTO_BLOQUEO =
  "Solo puedo ayudarle con el mantenimiento de su vehículo según las políticas de la agencia. Si lo desea, un asesor humano puede atenderle.";
const TEXTO_SINTOMA =
  "Por su seguridad, le recomendamos no conducir el vehículo hasta que lo revise un técnico. Un asesor le contactará de inmediato.";
const TEXTO_SEGURO =
  "Disculpe, no puedo darle esa respuesta. Un asesor humano revisará su consulta y le contactará en breve.";

function accionPolitica(call: ToolCall): AccionPolitica {
  switch (call.tool) {
    case "consultar_contexto_vehiculo":
      return "informar_km";
    case "verificar_stock_y_precio":
      return "informar_precio";
    case "agendar_bahia_taller":
      return "reservar_bahia";
    case "cotizar_aliados_seguros":
      return "recomendar_venta_cruzada";
    case "escalar_asesor_humano":
      return "escalar_asesor";
  }
}

const argConfirmado = (args: unknown): boolean =>
  typeof args === "object" && args !== null && (args as Record<string, unknown>).confirmadoPorCliente === true;

const bloqueada = (tool: ToolName, error: string): ToolResult => ({ tool, ok: false, error, trace: [] });

export function createAgent(deps: AgentDeps): Agent {
  const clock = deps.clock ?? Date.now;
  const scenarios = deps.scenarios ?? fixtures.scenarios;
  const ctx: ToolContext = { ports: deps.ports, now: deps.now };

  function abrirSesion(req: AgentRequest): SessionState {
    if (req.tipo === "inicio") {
      const sc = scenarios.find((s) => s.id === req.scenarioId);
      if (!sc) throw new SesionInvalidaError();
      return {
        sessionId: req.sessionId,
        scenarioId: req.scenarioId,
        vehicleId: sc.vehicleId,
        state: "TRIGGER",
        turnos: 0,
        intentosBloqueados: 0,
        quoteId: null,
        bookingId: null,
        ventaCruzada: "pendiente",
        casoAbiertoId: null,
        historial: [],
      };
    }
    if (!req.stateToken) throw new SesionInvalidaError();
    return verificarSesion(req.stateToken, {
      secret: deps.secret,
      sessionId: req.sessionId,
      scenarioId: req.scenarioId,
      nowMs: clock(),
    });
  }

  async function cargarPerfil(vehicleId: string): Promise<Perfil> {
    const vehicle = await deps.ports.crm.getVehicle(vehicleId);
    const owner = vehicle && (await deps.ports.crm.getOwner(vehicle.ownerId));
    if (!vehicle || !owner) throw new Error(`Perfil no encontrado en el CRM: ${vehicleId}`);
    const historial = await deps.ports.crm.getServiceHistory(vehicleId);
    const optIn = owner.consentimientos.some((c) => c.canal === "whatsapp" && c.optIn);
    return { vehicle, owner, historial, est: estimarKm(vehicle, deps.now), optIn };
  }

  async function escalar(
    a: Auditoria,
    s: SessionState,
    perfil: Perfil,
    h: { motivo: HandoffReason; prioridad: "alta" | "media" | "baja"; sintomas: string[]; ultimoMensaje: string; nota?: string },
  ): Promise<HandoffCase | undefined> {
    const auth = autorizarAccion("escalar_asesor", { confirmadoPorCliente: false });
    a.registrar(auth.trace);
    if (!auth.permitido) return undefined;
    const resumen = resumenCopiloto({
      motivo: h.motivo,
      sintomas: h.sintomas,
      vehiculo: `${perfil.vehicle.marca} ${perfil.vehicle.modelo} ${perfil.vehicle.anio}`,
      kmEstimado: perfil.est.kmEstimado,
      historial: perfil.historial,
      nota: h.nota,
    });
    const r = await executeTool(
      "escalar_asesor_humano",
      {
        vehicleId: s.vehicleId,
        motivo: h.motivo,
        prioridad: h.prioridad,
        resumen,
        sintomas: h.sintomas,
        ultimoMensaje: h.ultimoMensaje,
        trazaIds: a.exportar().map((e) => e.id),
      },
      ctx,
    );
    r.trace.forEach(a.registrar);
    const out = r.ok ? EscalarAsesorOutput.safeParse(r.output) : undefined;
    if (!out?.success) return undefined;
    const caso = out.data.caso;
    a.registrar(
      evento({
        kind: "handoff",
        agent: "Copiloto",
        name: "handoff_asesor",
        system: "CRM",
        status: "escalated",
        autonomy: "ejecutar",
        detalle: `Copiloto: caso ${caso.id} (${caso.motivo}, prioridad ${caso.prioridad}) en la bandeja del asesor. ${caso.resumen}`,
        payload: { casoId: caso.id, motivo: caso.motivo, prioridad: caso.prioridad, siguientePaso: caso.siguientePasoSugerido },
      }),
    );
    return caso;
  }

  const vacio = (s: SessionState): Omit<Resultado, "state" | "text"> => ({
    cards: [],
    alertas: [],
    intentosBloqueados: s.intentosBloqueados,
    toolResults: [],
    confirmada: false,
    // El modo informa del motor activo: un turno resuelto sin planner (Guardián, consentimiento)
    // no convierte a la IA en «reglas». El camino con planner lo corrige si hubo respaldo.
    llm: deps.planner.mode === "llm",
  });

  async function bloquear(a: Auditoria, s: SessionState, perfil: Perfil, v: GuardrailVerdict): Promise<Resultado> {
    if (v.categorias.includes("sin_consentimiento")) {
      return {
        ...vacio(s),
        state: s.state,
        text: TEXTO_SIN_CONSENTIMIENTO,
        cards: [{ type: "bloqueo", motivo: TEXTO_SIN_CONSENTIMIENTO }],
        alertas: ["Gate de consentimiento: sin opt-in de WhatsApp, no se contacta"],
      };
    }
    const adversarial = v.categorias.some((c) => c === "inyeccion" || c === "fraude");
    const caso = adversarial
      ? await escalar(a, s, perfil, { motivo: "adversarial", prioridad: "media", sintomas: [], ultimoMensaje: v.maskedInput })
      : undefined;
    return {
      ...vacio(s),
      state: "BLOQUEADO",
      text: TEXTO_BLOQUEO,
      cards: [{ type: "bloqueo", motivo: TEXTO_BLOQUEO }],
      caso,
      alertas: [`Bloqueado: ${v.categorias.join(", ")}`],
      intentosBloqueados: s.intentosBloqueados + 1,
    };
  }

  async function sintomaCritico(a: Auditoria, s: SessionState, perfil: Perfil, v: GuardrailVerdict, sintomas: string[]): Promise<Resultado> {
    const caso = await escalar(a, s, perfil, { motivo: "sintoma_critico", prioridad: "alta", sintomas, ultimoMensaje: v.maskedInput });
    return {
      ...vacio(s),
      state: caso ? "HANDOFF" : s.state,
      text: TEXTO_SINTOMA,
      caso,
      alertas: [`Síntoma crítico: ${sintomas.join(", ")}`],
    };
  }

  async function ejecutarLlamada(a: Auditoria, call: ToolCall, allowed: readonly ToolName[], clienteConfirmo: boolean): Promise<ToolResult> {
    if (!allowed.includes(call.tool)) {
      a.registrar(
        evento({
          kind: "policy",
          agent: "Guardián",
          name: "herramienta_no_permitida",
          system: "Guardián",
          status: "blocked",
          autonomy: "prohibido",
          detalle: `El planner propuso «${String(call.tool)}», que no está permitida en este estado: no se ejecuta.`,
          payload: { tool: String(call.tool), permitidas: [...allowed] },
        }),
      );
      return bloqueada(call.tool, "herramienta_no_permitida");
    }
    const confirmado = call.tool === "agendar_bahia_taller" && argConfirmado(call.args) && clienteConfirmo;
    const auth = autorizarAccion(accionPolitica(call), { confirmadoPorCliente: confirmado });
    a.registrar(auth.trace);
    if (!auth.permitido) return bloqueada(call.tool, "bloqueado_por_politica");
    const r = await executeTool(call.tool, call.args, ctx);
    r.trace.forEach(a.registrar);
    return r;
  }

  async function planificar(a: Auditoria, req: AgentRequest, s: SessionState, v: GuardrailVerdict) {
    const allowed = TOOLS_POR_ESTADO[s.state];
    const clienteConfirmo = confirmaReserva(detectarIntencion(req, v.maskedInput));
    const toolResults: ToolResult[] = [];
    let fallback = false;
    for (let iteration = 0; iteration < llmConfig.maxToolIterations; iteration++) {
      const r = await deps.planner.next({
        request: { ...req, message: v.maskedInput },
        maskedMessage: v.maskedInput,
        session: s,
        context: contextoDe(toolResults) ?? null,
        toolResults,
        allowedTools: [...allowed],
        iteration,
      });
      (r.trace ?? []).forEach(a.registrar);
      if (r.fallback) fallback = true;
      if (r.step.kind === "final") return { final: r.step, toolResults, fallback, clienteConfirmo };
      for (const call of r.step.calls) toolResults.push(await ejecutarLlamada(a, call, allowed, clienteConfirmo));
    }
    const final: Extract<PlannerStep, { kind: "final" }> = {
      kind: "final",
      text: "Necesito que un asesor revise su solicitud; le contactará en breve.",
      nextState: s.state,
      showCards: [],
    };
    return { final, toolResults, fallback, clienteConfirmo };
  }

  function estadoSeguro(next: AgentState, s: SessionState, hechos: { reserva: boolean; confirmada: boolean; caso: boolean }): AgentState {
    if (hechos.caso) return "HANDOFF";
    if (next === "CERRADO") return hechos.reserva && hechos.confirmada ? "CERRADO" : hechos.reserva ? "CONFIRMACION" : s.state;
    if (next === "HANDOFF" || next === "BLOQUEADO" || next === "TRIGGER") return s.state;
    return next;
  }

  async function conPlanner(a: Auditoria, req: AgentRequest, s: SessionState, perfil: Perfil, v: GuardrailVerdict): Promise<Resultado> {
    const { final, toolResults, fallback, clienteConfirmo } = await planificar(a, req, s, v);
    const confirmada = clienteConfirmo && detectarIntencion(req, v.maskedInput) === "confirmar";
    const t = construirTarjetas(final.showCards, toolResults, confirmada);
    for (const kind of t.sinRespaldo)
      a.registrar(
        evento({
          kind: "policy",
          agent: "Guardián",
          name: "tarjeta_sin_respaldo",
          system: "Guardián",
          status: "blocked",
          detalle: `El planner pidió la tarjeta «${kind}» sin un resultado verificado de herramienta: no se muestra.`,
          payload: { tarjeta: kind },
        }),
      );
    let caso = toolResults
      .filter((r) => r.tool === "escalar_asesor_humano" && r.ok)
      .map((r) => EscalarAsesorOutput.safeParse(r.output))
      .flatMap((p) => (p.success ? [p.data.caso] : []))
      .at(-1);
    if (!caso && final.handoff)
      caso = await escalar(a, s, perfil, {
        motivo: final.handoff.motivo,
        prioridad: final.handoff.prioridad,
        sintomas: [],
        ultimoMensaje: v.maskedInput,
        nota: final.handoff.resumen,
      });
    // T21: el caso de venta de seguro lo atiende un asesor, pero no bloquea la conversación (puede seguir agendando).
    const state = estadoSeguro(final.nextState, s, { reserva: !!t.booking, confirmada, caso: !!caso && caso.motivo !== "seguro" });
    return {
      ...vacio(s),
      state,
      text: final.text,
      cards: t.cards,
      caso,
      toolResults,
      confirmada,
      llm: deps.planner.mode === "llm" && !fallback,
    };
  }

  /** Guardián de salida: total recalculado desde el tarifario; si bloquea, texto seguro + escalar. */
  async function revisarSalida(a: Auditoria, s: SessionState, perfil: Perfil, r: Resultado) {
    const quote = r.cards.flatMap((c) => (c.type === "cotizacion" ? [c.quote] : [])).at(0);
    const salida = validarSalida({
      text: r.text,
      ...(quote
        ? {
            cotizacionTotalUsd: quote.totalUsd,
            totalRecalculadoUsd: await recalcularTotal(deps.ports, quote),
            descuentoPct: quote.descuentoPct,
          }
        : {}),
    });
    salida.trace.forEach(a.registrar);
    if (salida.verdict.allow) return { r, salida: salida.verdict };
    const motivo: HandoffReason = salida.verdict.reasons.some((x) => /garant/i.test(x)) ? "garantia" : "adversarial";
    const caso =
      r.caso ??
      (await escalar(a, s, perfil, {
        motivo,
        prioridad: "media",
        sintomas: [],
        ultimoMensaje: "",
        nota: "El Guardián bloqueó la respuesta del agente",
      }));
    return {
      r: { ...r, text: TEXTO_SEGURO, cards: [], caso, state: caso ? ("HANDOFF" as const) : r.state },
      salida: salida.verdict,
    };
  }

  function memoria(s: SessionState, perfil: Perfil, alertas: string[]): MemorySnapshot {
    const { vehicle, est } = perfil;
    return {
      proactivo: {
        contactosUltimos30Dias: perfil.owner.contactosUltimos30Dias,
        optInWhatsapp: perfil.optIn,
        motivoContacto: perfil.optIn ? `Hito de ${est.proximoHitoKm} km en ${est.diasParaHito} días` : null,
      },
      postventa: {
        turnos: s.turnos,
        estado: s.state,
        perfilVehiculo: {
          descripcion: `${vehicle.marca} ${vehicle.modelo} ${vehicle.anio}`,
          kmEstimado: est.kmEstimado,
          proximoHitoKm: est.proximoHitoKm,
        },
        historialServicios: perfil.historial.map((h) => ({ fecha: h.fecha, km: h.km, servicio: h.servicio, enAgencia: h.enAgencia })),
        cotizacionId: s.quoteId,
        reservaId: s.bookingId,
      },
      guardian: {
        intentosBloqueados: s.intentosBloqueados,
        alertas: [...alertas, ...(s.intentosBloqueados > 0 ? [`Intentos bloqueados en la sesión: ${s.intentosBloqueados}`] : [])],
      },
      copiloto: { casoAbiertoId: s.casoAbiertoId },
    };
  }

  function nuevaSesion(req: AgentRequest, s: SessionState, r: Resultado, maskedInput: string): SessionState {
    const quote = cotizacionDe(r.toolResults);
    const booking = r.cards.flatMap((c) => (c.type === "reserva" ? [c.booking] : [])).at(0) ?? agendaDe(r.toolResults)?.booking;
    const intencion = req.tipo === "inicio" ? "inicio" : detectarIntencion(req, maskedInput);
    const extras = quote ? (parseQuoteId(quote.id)?.extras ?? []) : [];
    const ventaCruzada =
      intencion === "rechazar_venta_cruzada" ? "rechazada" : extras.length > 0 ? "aceptada" : s.ventaCruzada;
    const cliente = req.tipo === "inicio" ? "[inicio de la demo]" : req.accion ? `[acción: ${req.accion}]` : maskedInput;
    return {
      ...s,
      state: r.state,
      turnos: s.turnos + 1,
      intentosBloqueados: r.intentosBloqueados,
      quoteId: quote?.id ?? s.quoteId,
      bookingId: booking?.id ?? s.bookingId,
      ventaCruzada,
      casoAbiertoId: r.caso?.id ?? s.casoAbiertoId,
      historial: [...s.historial, { rol: "cliente" as const, texto: cliente }, { rol: "agente" as const, texto: r.text }].slice(-12),
    };
  }

  async function runTurn(req: AgentRequest): Promise<AgentTurn> {
    const s = abrirSesion(req);
    const a = crearAuditoria();
    const perfil = await cargarPerfil(s.vehicleId);
    const entrada = evaluarEntrada({
      message: req.message,
      tipo: req.tipo,
      optInWhatsapp: perfil.optIn,
      intentosBloqueados: s.intentosBloqueados,
    });
    entrada.trace.forEach(a.registrar);
    const v = entrada.verdict;

    const bruto =
      v.action === "bloquear"
        ? await bloquear(a, s, perfil, v)
        : v.action === "escalar"
          ? await sintomaCritico(a, s, perfil, v, entrada.sintomas)
          : await conPlanner(a, req, s, perfil, v);
    const { r, salida } = await revisarSalida(a, s, perfil, bruto);
    const cards: ReplyCard[] = r.caso
      ? [...r.cards, { type: "handoff", casoId: r.caso.id, mensaje: "Un asesor humano tomará su caso y le contactará." }]
      : r.cards;

    const s2 = nuevaSesion(req, s, r, v.maskedInput);
    a.registrar(
      evento({
        kind: "state",
        agent: "Postventa",
        name: "transicion_estado",
        system: "CRM",
        status: r.state === "BLOQUEADO" ? "blocked" : r.state === "HANDOFF" ? "escalated" : "ok",
        detalle: `Estado: ${s.state} → ${r.state}`,
        payload: { desde: s.state, hacia: r.state, turno: s2.turnos },
      }),
    );
    a.registrar(
      evento({
        kind: "memory",
        agent: "Postventa",
        name: "memoria_sesion",
        system: "CRM",
        status: "ok",
        detalle: `Memoria firmada (HMAC): turno ${s2.turnos}, cotización ${s2.quoteId ?? "—"}, reserva ${s2.bookingId ?? "—"}, intentos bloqueados ${s2.intentosBloqueados}`,
        payload: { turnos: s2.turnos, estado: s2.state, quoteId: s2.quoteId, bookingId: s2.bookingId, casoAbiertoId: s2.casoAbiertoId, intentosBloqueados: s2.intentosBloqueados },
      }),
    );

    return {
      sessionId: req.sessionId,
      turnId: crypto.randomUUID(),
      state: r.state,
      reply: { text: r.text, cards },
      trace: a.exportar(),
      ...(r.caso ? { handoff: r.caso } : {}),
      guardrail: { entrada: v, salida },
      mode: r.llm ? "llm" : "deterministic",
      memory: memoria(s2, perfil, r.alertas),
      stateToken: firmarSesion(s2, deps.secret, clock()),
    };
  }

  return { runTurn };
}
