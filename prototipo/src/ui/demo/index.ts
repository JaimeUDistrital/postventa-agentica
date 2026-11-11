"use client";
/**
 * Controlador de la demo: escenarios, guion paso a paso (T12) y código del jurado.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import scenariosData from "@/core/data/scenarios.json";
import { AgentTurn, type AgentRequest, type HandoffCase, type ScenarioId, type UserAction } from "@/core/contracts";
import type { ChatMessage, ClientSnapshot, DemoSession } from "@/ui/contracts";

const GUIONES: Record<string, string[]> = Object.fromEntries(
  (scenariosData as { id: string; mensajesGuion: string[] }[]).map((s) => [s.id, s.mensajesGuion]),
);
const CLAVE_CODIGO = "postventa.codigo";

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
    accessCodeRef.current = codigo || null;
    setAccessCodeActive(!!codigo);
  }, []);

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
      setClients((c) => ({
        ...c,
        [req.scenarioId]: { state: turn.state, sinPermisoWhatsapp: !turn.memory.proactivo.optInWhatsapp },
      }));
      setMessages((m) => [
        ...m,
        { id: turn.turnId, rol: "agente", texto: turn.reply.text, cards: turn.reply.cards, turnId: turn.turnId },
      ]);
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
  };
}
