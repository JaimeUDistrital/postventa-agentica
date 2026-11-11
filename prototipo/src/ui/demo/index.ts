"use client";
/**
 * Controlador de la demo: escenarios, guion paso a paso (T12) y código del jurado.
 * T22: una conversación por cliente (se conserva al cambiar de cliente), toma de caso por el
 * asesor (la IA queda en pausa para ese cliente), respuestas y llamadas del asesor.
 * Todo vive en la memoria del navegador; en producción iría a una base de datos (Fase 2).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import scenariosData from "@/core/data/scenarios.json";
import { AgentTurn, type AgentRequest, type HandoffCase, type ScenarioId, type UserAction } from "@/core/contracts";
import {
  ASESOR_DEMO,
  RESULTADO_LLAMADA_LABEL,
  type ChatMessage,
  type ClientSnapshot,
  type DemoBooking,
  type DemoMode,
  type DemoSession,
  type ResultadoLlamada,
} from "@/ui/contracts";
import { formatHoraReloj } from "@/ui/owner/format";
import { crearPreferencia } from "@/ui/preferencias";

const GUIONES: Record<string, string[]> = Object.fromEntries(
  (scenariosData as { id: string; mensajesGuion: string[] }[]).map((s) => [s.id, s.mensajesGuion]),
);
const CLAVE_CODIGO = "postventa.codigo";
/** T20 · F2: preferencia del visitante (solo comodidad; sin ella arranca en «Demo guiada»). */
const useModoDemo = crearPreferencia<DemoMode>("postventa.modoDemo", "guiada", ["guiada", "libre"]);

/** T22: mismo límite que `AgentRequest.message` y que el campo del cliente. */
const MAX_MENSAJE = 1000;
export const TEXTO_PAUSA = "La IA está en pausa: le atiende un asesor";

const ahora = () => new Date().toISOString();
const nota = (texto: string, evento: ChatMessage["evento"], ts = ahora()): ChatMessage => ({
  id: crypto.randomUUID(),
  rol: "sistema",
  texto,
  cards: [],
  ts,
  evento,
});

/**
 * T20 · C: si el Guardián frenó el contacto por falta de permiso (veredicto de entrada con
 * `sin_consentimiento`), no se le envió nada al cliente: el texto es una nota interna del sistema
 * y la tarjeta de bloqueo (mismo texto) no se muestra en el teléfono.
 */
export function mensajeDelTurno(turn: AgentTurn, ts = ahora()): ChatMessage {
  if (turn.guardrail.entrada.categorias.includes("sin_consentimiento"))
    return { id: turn.turnId, rol: "sistema", texto: turn.reply.text, cards: [], turnId: turn.turnId, ts, evento: "consentimiento" };
  return { id: turn.turnId, rol: "agente", texto: turn.reply.text, cards: turn.reply.cards, turnId: turn.turnId, ts };
}

/** T20 · G: añade o actualiza (misma referencia) las reservas que trae un turno. */
export function conReservas(previas: DemoBooking[], scenarioId: ScenarioId, turn: AgentTurn): DemoBooking[] {
  let out = previas;
  for (const c of turn.reply.cards) {
    if (c.type !== "reserva") continue;
    const nueva = { scenarioId, booking: c.booking };
    out = out.some((b) => b.booking.id === c.booking.id)
      ? out.map((b) => (b.booking.id === c.booking.id ? nueva : b))
      : [...out, nueva];
  }
  return out;
}

/** T22: la nota de pausa sale una vez por intervención del asesor (no tras cada mensaje del cliente). */
export function necesitaNotaPausa(messages: ChatMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.evento === "pausa") return false;
    if (m.rol === "asesor" || m.evento === "toma") return true;
  }
  return true;
}

/** T22: lo que la demo recuerda de cada cliente mientras dura la visita. */
interface Conversacion {
  messages: ChatMessage[];
  turns: AgentTurn[];
  scriptStep: number;
}
const VACIA: Conversacion = { messages: [], turns: [], scriptStep: 0 };

export function useDemoSession(): DemoSession {
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(null);
  const [conversaciones, setConversaciones] = useState<Partial<Record<ScenarioId, Conversacion>>>({});
  const [cases, setCases] = useState<HandoffCase[]>([]);
  /** Cliente (escenario) de cada caso, para llevar la intervención del asesor a su conversación. */
  const [clienteDelCaso, setClienteDelCaso] = useState<Record<string, ScenarioId>>({});
  /** Clientes cuyo caso tomó un asesor: la IA no les responde. */
  const [enPausa, setEnPausa] = useState<Partial<Record<ScenarioId, true>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessCodeActive, setAccessCodeActive] = useState(false);
  const [clients, setClients] = useState<Partial<Record<ScenarioId, ClientSnapshot>>>({});
  const [bookings, setBookings] = useState<DemoBooking[]>([]);
  const accessCodeRef = useRef<string | null>(null);
  /** Sesión del agente de cada cliente (token firmado del último turno). */
  const sesiones = useRef<Partial<Record<ScenarioId, { sessionId: string; stateToken?: string }>>>({});

  // Código del jurado: solo en el cliente, tras montar. No se registra ni se muestra.
  useEffect(() => {
    let codigo: string | null = null;
    try {
      codigo = new URLSearchParams(window.location.search).get("codigo");
      if (codigo) window.sessionStorage.setItem(CLAVE_CODIGO, codigo);
      else codigo = window.sessionStorage.getItem(CLAVE_CODIGO);
    } catch {
      /* sessionStorage no disponible */
    }
    // T20 · D: el código no se queda a la vista en la barra de direcciones (ruta, otros parámetros y ancla se conservan).
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("codigo")) {
        url.searchParams.delete("codigo");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      /* history no disponible: la URL queda igual y el código sigue activo */
    }
    accessCodeRef.current = codigo || null;
    setAccessCodeActive(!!codigo);
  }, []);

  const [demoMode, setDemoMode] = useModoDemo();

  const conConversacion = useCallback((id: ScenarioId, cambio: (c: Conversacion) => Conversacion) => {
    setConversaciones((cs) => ({ ...cs, [id]: cambio(cs[id] ?? VACIA) }));
  }, []);
  const agregar = useCallback(
    (id: ScenarioId, ...nuevos: ChatMessage[]) => conConversacion(id, (c) => ({ ...c, messages: [...c.messages, ...nuevos] })),
    [conConversacion],
  );

  const call = useCallback(
    async (req: Omit<AgentRequest, "sessionId" | "stateToken">) => {
      const s = sesiones.current[req.scenarioId];
      if (!s) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...req, sessionId: s.sessionId, stateToken: s.stateToken,
            ...(accessCodeRef.current ? { accessCode: accessCodeRef.current } : {}),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const turn = AgentTurn.parse(await res.json());
        // «Reiniciar» llegó mientras se esperaba: la respuesta es de una sesión que ya no existe.
        if (sesiones.current[req.scenarioId] !== s) return;
        s.stateToken = turn.stateToken;
        conConversacion(req.scenarioId, (c) => ({
          ...c,
          turns: [...c.turns, turn],
          messages: [...c.messages, mensajeDelTurno(turn)],
        }));
        setBookings((b) => conReservas(b, req.scenarioId, turn));
        setClients((c) => ({
          ...c,
          [req.scenarioId]: {
            state: turn.state,
            sinPermisoWhatsapp: !turn.memory.proactivo.optInWhatsapp,
            seguroElegido: !!c[req.scenarioId]?.seguroElegido || turn.handoff?.motivo === "seguro",
          },
        }));
        const handoff = turn.handoff;
        if (handoff) {
          setCases((c) => [handoff, ...c.filter((x) => x.id !== handoff.id)]);
          setClienteDelCaso((m) => ({ ...m, [handoff.id]: req.scenarioId }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    },
    [conConversacion],
  );

  const selectScenario = useCallback(
    (id: ScenarioId) => {
      setScenarioId(id);
      // T22: si ya hay conversación con este cliente, solo se vuelve a mostrar.
      if (sesiones.current[id]) return;
      sesiones.current[id] = { sessionId: crypto.randomUUID() };
      setConversaciones((cs) => ({ ...cs, [id]: VACIA }));
      void call({ scenarioId: id, tipo: "inicio", message: "" });
    },
    [call],
  );

  const send = useCallback(
    (text: string) => {
      if (!scenarioId || !text.trim()) return;
      const delCliente: ChatMessage = { id: crypto.randomUUID(), rol: "cliente", texto: text, cards: [], ts: ahora() };
      if (enPausa[scenarioId]) {
        // T22: con un asesor a cargo, el mensaje se ve en el chat pero no va a la IA.
        conConversacion(scenarioId, (c) => ({
          ...c,
          messages: necesitaNotaPausa(c.messages) ? [...c.messages, delCliente, nota(TEXTO_PAUSA, "pausa")] : [...c.messages, delCliente],
        }));
        return;
      }
      agregar(scenarioId, delCliente);
      void call({ scenarioId, tipo: "mensaje", message: text });
    },
    [agregar, call, conConversacion, enPausa, scenarioId],
  );

  const act = useCallback(
    (accion: UserAction) => {
      if (!scenarioId || enPausa[scenarioId]) return;
      void call({ scenarioId, tipo: "accion", message: "", accion });
    },
    [call, enPausa, scenarioId],
  );

  const actual = scenarioId ? (conversaciones[scenarioId] ?? VACIA) : VACIA;
  const scriptStep = actual.scriptStep;
  const scriptTotal = scenarioId ? (GUIONES[scenarioId]?.length ?? 0) : 0;
  const nextScript = useCallback(() => {
    if (!scenarioId || loading) return;
    const msg = GUIONES[scenarioId]?.[scriptStep];
    if (msg === undefined) return;
    conConversacion(scenarioId, (c) => ({ ...c, scriptStep: c.scriptStep + 1 }));
    send(msg);
  }, [conConversacion, scenarioId, loading, scriptStep, send]);

  const reset = useCallback(() => {
    sesiones.current = {};
    setScenarioId(null);
    setConversaciones({});
    setCases([]);
    setClienteDelCaso({});
    setEnPausa({});
    setClients({});
    setBookings([]);
    setError(null);
  }, []);

  const takeCase = useCallback(
    (id: string) => {
      const caso = cases.find((x) => x.id === id);
      if (!caso || caso.estado !== "abierto") return;
      setCases((c) => c.map((x) => (x.id === id ? { ...x, estado: "tomado" } : x)));
      const cliente = clienteDelCaso[id];
      if (!cliente) return;
      setEnPausa((p) => ({ ...p, [cliente]: true }));
      const ts = ahora();
      agregar(cliente, nota(`${ASESOR_DEMO} (asesor) tomó el caso · ${formatHoraReloj(ts)}`, "toma", ts));
    },
    [agregar, cases, clienteDelCaso],
  );

  const replyAsAdvisor = useCallback(
    (caseId: string, texto: string) => {
      const cliente = clienteDelCaso[caseId];
      const limpio = texto.trim().slice(0, MAX_MENSAJE);
      if (!cliente || !limpio) return;
      agregar(cliente, { id: crypto.randomUUID(), rol: "asesor", texto: limpio, cards: [], ts: ahora(), autor: ASESOR_DEMO });
    },
    [agregar, clienteDelCaso],
  );

  const logCall = useCallback(
    (caseId: string, resultado: ResultadoLlamada, notaLlamada: string) => {
      const cliente = clienteDelCaso[caseId];
      if (!cliente) return;
      const texto = ["Llamada del asesor", RESULTADO_LLAMADA_LABEL[resultado], notaLlamada.trim()].filter(Boolean).join(" · ");
      agregar(cliente, { id: crypto.randomUUID(), rol: "asesor", texto, cards: [], ts: ahora(), autor: ASESOR_DEMO, evento: "llamada" });
    },
    [agregar, clienteDelCaso],
  );

  return {
    scenarioId,
    messages: actual.messages,
    turns: actual.turns,
    cases,
    loading,
    error,
    mode: actual.turns.at(-1)?.mode ?? null,
    selectScenario,
    send,
    act,
    reset,
    takeCase,
    scriptStep,
    scriptTotal,
    nextScript,
    accessCodeActive,
    clients,
    demoMode,
    setDemoMode,
    bookings,
    aiPaused: scenarioId ? !!enPausa[scenarioId] : false,
    replyAsAdvisor,
    logCall,
  };
}
