/**
 * T19 · «Qué hizo el agente»: traduce los TraceEvent técnicos a frases para el asesor.
 * Los eventos sin valor para él (planner determinista, políticas aprobadas, guardián sin
 * hallazgos, transición de estado, memoria, tool_call) se omiten: siguen en el detalle técnico.
 */
import type { AgentTurn, TraceEvent } from "@/core/contracts";

export type Resultado = "listo" | "atencion" | "asesor" | "bloqueado" | "pausado" | "error";

export const RESULTADO_LABEL: Record<Resultado, string> = {
  listo: "Listo",
  atencion: "Requiere atención",
  asesor: "Pasado a asesor",
  bloqueado: "Bloqueado",
  pausado: "En pausa",
  error: "Con error",
};

export interface Actividad {
  id: string;
  texto: string;
  resultado: Resultado;
  /** Veces seguidas que ocurrió lo mismo en turnos consecutivos. */
  veces: number;
}

type Frase = { texto: string; resultado: Resultado } | null;

function herramienta(e: TraceEvent, turn: AgentTurn): Frase {
  switch (e.name) {
    case "consultar_contexto_vehiculo":
      return { texto: "Revisó el historial del vehículo", resultado: "listo" };
    case "verificar_stock_y_precio":
      return Number(e.payload.sinStock) > 0
        ? { texto: "Encontró un repuesto agotado", resultado: "atencion" }
        : { texto: "Revisó repuestos y precio en el tarifario", resultado: "listo" };
    case "agendar_bahia_taller": {
      const estado = e.payload.estado;
      if (estado === "sin_stock")
        return { texto: "No pudo agendar porque falta un repuesto; propuso otras fechas", resultado: "atencion" };
      if (estado === "sin_disponibilidad")
        return { texto: "No encontró cupo y propuso otros horarios", resultado: "atencion" };
      return turn.state === "CERRADO"
        ? { texto: "Confirmó la cita en el taller", resultado: "listo" }
        : { texto: "Apartó un espacio en el taller", resultado: "listo" };
    }
    case "cotizar_aliados_seguros":
      return { texto: "Buscó seguros con las aseguradoras aliadas", resultado: "listo" };
    case "escalar_asesor_humano":
      return { texto: "Le pasó el caso a un asesor", resultado: "asesor" };
    default:
      return { texto: "Consultó un sistema de la agencia", resultado: "listo" };
  }
}

export function describirEvento(e: TraceEvent, turn: AgentTurn): Frase {
  if (e.status === "error") return { texto: "Tuvo un problema técnico al consultar un sistema", resultado: "error" };
  switch (e.kind) {
    case "tool_result":
      return herramienta(e, turn);
    case "handoff":
      return { texto: "Le pasó el caso a un asesor", resultado: "asesor" };
    case "guardrail":
      if (e.status === "blocked") return { texto: "Bloqueó un intento de manipulación", resultado: "bloqueado" };
      if (e.status === "escalated") return { texto: "Detectó un riesgo de seguridad", resultado: "asesor" };
      return null;
    case "policy":
      if (e.status !== "blocked") return null;
      return e.name === "gate_consentimiento"
        ? { texto: "No le escribió al cliente: no autorizó WhatsApp", resultado: "pausado" }
        : { texto: "Frenó una acción no permitida", resultado: "bloqueado" };
    case "llm":
      // Con el «Motor: reglas» el planner es determinista: no hubo IA que contar.
      return turn.mode === "llm" ? { texto: "Consultó la IA", resultado: "listo" } : null;
    default:
      return null;
  }
}

/** Lista cronológica sin repeticiones: una frase por turno y las seguidas entre turnos se agrupan. */
export function resumirActividad(turns: AgentTurn[]): Actividad[] {
  const out: Actividad[] = [];
  for (const turn of turns) {
    const vistas = new Set<string>();
    const delTurno: Actividad[] = [];
    for (const e of turn.trace) {
      const f = describirEvento(e, turn);
      if (!f || vistas.has(f.texto)) continue;
      vistas.add(f.texto);
      delTurno.push({ id: e.id, ...f, veces: 1 });
    }
    for (const a of delTurno) {
      const prev = out.at(-1);
      if (prev && prev.texto === a.texto && prev.resultado === a.resultado) prev.veces += 1;
      else out.push(a);
    }
  }
  return out;
}
