"use client";
/**
 * Versión mínima (T00) del controlador de la demo. T12 la amplía (guion paso a paso,
 * animación de traza) sin cambiar la interfaz `DemoSession`.
 */
import { useCallback, useRef, useState } from "react";
import { AgentTurn, type AgentRequest, type HandoffCase, type ScenarioId, type UserAction } from "@/core/contracts";
import type { ChatMessage, DemoSession } from "@/ui/contracts";

export function useDemoSession(): DemoSession {
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [cases, setCases] = useState<HandoffCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<{ sessionId: string; stateToken?: string } | null>(null);

  const call = useCallback(async (req: Omit<AgentRequest, "sessionId" | "stateToken">) => {
    const s = sessionRef.current;
    if (!s) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...req, sessionId: s.sessionId, stateToken: s.stateToken }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const turn = AgentTurn.parse(await res.json());
      s.stateToken = turn.stateToken;
      setTurns((t) => [...t, turn]);
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

  const reset = useCallback(() => {
    sessionRef.current = null;
    setScenarioId(null);
    setMessages([]);
    setTurns([]);
    setCases([]);
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
  };
}
