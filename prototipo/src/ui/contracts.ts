/**
 * Contratos entre las zonas de la UI (T05 owner, T06 xray/advisor, T12 demo).
 * Dueño: Orquestador.
 */
import type { AgentState, AgentTurn, HandoffCase, ReplyCard, ScenarioId, UserAction } from "@/core/contracts";

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
  /** T19 (aditivo): último estado conocido de cada cliente (escenario) en esta demo. */
  clients?: Partial<Record<ScenarioId, ClientSnapshot>>;
}

/** T19: lo mínimo que la lista «Clientes de hoy» necesita de cada cliente. */
export interface ClientSnapshot {
  state: AgentState;
  /** El cliente no autorizó contacto por WhatsApp (memoria del agente Proactivo). */
  sinPermisoWhatsapp: boolean;
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

/**
 * Escenarios de la demo. T19 (aditivo): `cliente`, `vehiculo` y `situacion` para la lista
 * «Clientes de hoy». Copiados a mano (solo alias y modelo, sin PII) para no importar
 * owners.json ni vehicles.json en el cliente.
 */
export const SCENARIOS: {
  id: ScenarioId;
  label: string;
  tipo: "feliz" | "falla";
  cliente?: string;
  vehiculo?: string;
  situacion?: string;
}[] = [
  { id: "feliz", label: "Mantenimiento 30.000 km", tipo: "feliz", cliente: "Mariana S.", vehiculo: "Mazda CX-30 2023", situacion: "Le toca el mantenimiento de 30.000 km" },
  { id: "sintoma_critico", label: "Síntoma crítico", tipo: "falla", cliente: "Andrés F.", vehiculo: "Toyota Corolla Cross 2022", situacion: "Reporta olor a quemado" },
  { id: "sin_stock", label: "Repuesto sin stock", tipo: "falla", cliente: "Camila A.", vehiculo: "Renault Duster 2021", situacion: "Falta un repuesto" },
  { id: "adversarial", label: "Intento de manipulación", tipo: "falla", cliente: "Julián E.", vehiculo: "Chevrolet Onix 2022", situacion: "Pide un precio irreal" },
  { id: "sin_consentimiento", label: "Sin consentimiento", tipo: "falla", cliente: "Daniela L.", vehiculo: "Kia Picanto 2021", situacion: "No autorizó WhatsApp" },
];
