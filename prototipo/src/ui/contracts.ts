/**
 * Contratos entre las zonas de la UI (T05 owner, T06 xray/advisor, T12 demo).
 * Dueño: Orquestador.
 */
import type { AgentTurn, HandoffCase, ReplyCard, ScenarioId, UserAction } from "@/core/contracts";

export interface ChatMessage {
  id: string;
  rol: "cliente" | "agente" | "sistema";
  texto: string;
  cards: ReplyCard[];
  turnId?: string;
}

export interface DemoSession {
  scenarioId: ScenarioId | null;
  messages: ChatMessage[];
  turns: AgentTurn[];
  cases: HandoffCase[];
  loading: boolean;
  error: string | null;
  mode: AgentTurn["mode"] | null;
  selectScenario(id: ScenarioId): void;
  send(text: string): void;
  act(accion: UserAction): void;
  reset(): void;
  takeCase(id: string): void;
  /** Guion de demo (T12, aditivo): mensajes ya enviados / total del escenario. */
  scriptStep?: number;
  scriptTotal?: number;
  /** Envía el siguiente mensaje de `mensajesGuion`. */
  nextScript?(): void;
  /** Hay un código del jurado activo (nunca se expone su valor). */
  accessCodeActive?: boolean;
}

export interface OwnerAppProps {
  session: DemoSession;
}

export interface XrayConsoleProps {
  turns: AgentTurn[];
}

export interface AdvisorInboxProps {
  cases: HandoffCase[];
  onTake(id: string): void;
}

/** Etiquetas de los botones de escenario (1 clic). */
export const SCENARIOS: { id: ScenarioId; label: string; tipo: "feliz" | "falla" }[] = [
  { id: "feliz", label: "Mantenimiento 30.000 km", tipo: "feliz" },
  { id: "sintoma_critico", label: "Síntoma crítico", tipo: "falla" },
  { id: "sin_stock", label: "Repuesto sin stock", tipo: "falla" },
  { id: "adversarial", label: "Intento de manipulación", tipo: "falla" },
  { id: "sin_consentimiento", label: "Sin consentimiento", tipo: "falla" },
];
