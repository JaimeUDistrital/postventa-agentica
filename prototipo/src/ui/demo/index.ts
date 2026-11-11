"use client";
/**
 * Controlador de la demo: escenarios, guion paso a paso (T12) y código del jurado.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import scenariosData from "@/core/data/scenarios.json";
import { AgentTurn, type AgentRequest, type HandoffCase, type ScenarioId, type UserAction } from "@/core/contracts";
import type { ChatMessage, ClientSnapshot, DemoBooking, DemoMode, DemoSession } from "@/ui/contracts";

const GUIONES: Record<string, string[]> = Object.fromEntries(
  (scenariosData as { id: string; mensajesGuion: string[] }[]).map((s) => [s.id, s.mensajesGuion]),
);
const CLAVE_CODIGO = "postventa.codigo";
/** T20 · F2: preferencia del visitante (solo comodidad; sin ella arranca en «Demo guiada»). */
const CLAVE_MODO = "postventa.modoDemo";
const avisosModo = new Set<() => void>();
/** Respaldo si el navegador bloquea localStorage: la elección dura solo esta visita. */
let modoEnMemoria: DemoMode = "guiada";

function leerModo(): DemoMode {
  try {
    return window.localStorage.getItem(CLAVE_MODO) === "libre" ? "libre" : "guiada";
  } catch {
    return modoEnMemoria;
  }
}
const modoServidor = (): DemoMode => "guiada";
function guardarModo(modo: DemoMode): void {
  modoEnMemoria = modo;
  try {
    window.localStorage.setItem(CLAVE_MODO, modo);
  } catch {
    /* localStorage no disponible */
  }
  avisosModo.forEach((avisar) => avisar());
}
function suscribirModo(avisar: () => void): () => void {
  avisosModo.add(avisar);
  return () => avisosModo.delete(avisar);
}

/**
 * T20 · C: si el Guardián frenó el contacto por falta de permiso (veredicto de entrada con
 * `sin_consentimiento`), no se le envió nada al cliente: el texto es una nota interna del sistema
 * y la tarjeta de bloqueo (mismo texto) no se muestra en el teléfono.
 */
export function mensajeDelTurno(turn: AgentTurn): ChatMessage {
  if (turn.guardrail.entrada.categorias.includes("sin_consentimiento"))
    return { id: turn.turnId, rol: "sistema", texto: turn.reply.text, cards: [], turnId: turn.turnId };
  return { id: turn.turnId, rol: "agente", texto: turn.reply.text, cards: turn.reply.cards, turnId: turn.turnId };
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

export function useDemoSession(): DemoSession {
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [cases, setCases] = useState<HandoffCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptStep, setScriptStep] = useState(0);
  const [accessCodeActive, setAccessCodeActive] = useState(false);
  const [clients, setClients] = useState<Partial<Record<ScenarioId, ClientSnapshot>>>({});
  const [bookings, setBookings] = useState<DemoBooking[]>([]);
  const accessCodeRef = useRef<string | null>(null);
  const sessionRef = useRef<{ sessionId: string; stateToken?: string } | null>(null);

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

  // En el servidor (y al hidratar) siempre «guiada»; luego, la preferencia guardada del visitante.
  const demoMode = useSyncExternalStore(suscribirModo, leerModo, modoServidor);
  const setDemoMode = useCallback((modo: DemoMode) => guardarModo(modo), []);

  const call = useCallback(async (req: Omit<AgentRequest, "sessionId" | "stateToken">) => {
    const s = sessionRef.current;
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
      s.stateToken = turn.stateToken;
      setTurns((t) => [...t, turn]);
      setBookings((b) => conReservas(b, req.scenarioId, turn));
      setClients((c) => ({
        ...c,
        [req.scenarioId]: { state: turn.state, sinPermisoWhatsapp: !turn.memory.proactivo.optInWhatsapp },
      }));
      setMessages((m) => [...m, mensajeDelTurno(turn)]);
      const handoff = turn.handoff;
      if (handoff) setCases((c) => [handoff, ...c.filter((x) => x.id !== handoff.id)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectScenario = useCallback(
    (id: ScenarioId) => {
      sessionRef.current = { sessionId: crypto.randomUUID() };
      setScenarioId(id);
      setScriptStep(0);
      setMessages([]);
      setTurns([]);
      void call({ scenarioId: id, tipo: "inicio", message: "" });
    },
    [call],
  );

  const send = useCallback(
    (text: string) => {
      if (!scenarioId || !text.trim()) return;
      setMessages((m) => [...m, { id: crypto.randomUUID(), rol: "cliente", texto: text, cards: [] }]);
      void call({ scenarioId, tipo: "mensaje", message: text });
    },
    [call, scenarioId],
  );

  const act = useCallback(
    (accion: UserAction) => {
      if (!scenarioId) return;
      void call({ scenarioId, tipo: "accion", message: "", accion });
    },
    [call, scenarioId],
  );

  const scriptTotal = scenarioId ? (GUIONES[scenarioId]?.length ?? 0) : 0;
  const nextScript = useCallback(() => {
    if (!scenarioId || loading) return;
    const msg = GUIONES[scenarioId]?.[scriptStep];
    if (msg === undefined) return;
    setScriptStep(scriptStep + 1);
    send(msg);
  }, [scenarioId, loading, scriptStep, send]);

  const reset = useCallback(() => {
    sessionRef.current = null;
    setScenarioId(null);
    setScriptStep(0);
    setMessages([]);
    setTurns([]);
    setCases([]);
    setClients({});
    setBookings([]);
    setError(null);
  }, []);

  const takeCase = useCallback((id: string) => {
    setCases((c) => c.map((x) => (x.id === id ? { ...x, estado: "tomado" } : x)));
  }, []);

  return {
    scenarioId,
    messages,
    turns,
    cases,
    loading,
    error,
    mode: turns.at(-1)?.mode ?? null,
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
  };
}
