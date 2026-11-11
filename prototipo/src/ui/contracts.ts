/**
 * Contratos entre las zonas de la UI (T05 owner, T06 xray/advisor, T12 demo).
 * Dueño: Orquestador.
 */
import type { AgentState, AgentTurn, Booking, HandoffCase, ReplyCard, ScenarioId, UserAction } from "@/core/contracts";

export interface ChatMessage {
  id: string;
  /** T22: «asesor» = una persona de la agencia (no la IA). */
  rol: "cliente" | "agente" | "asesor" | "sistema";
  texto: string;
  cards: ReplyCard[];
  turnId?: string;
  /** T22: hora ISO en que entró en la conversación (para la auditoría). */
  ts?: string;
  /** T22: nombre de la persona que lo escribió (rol «asesor»). */
  autor?: string;
  /** T22: notas del sistema (consentimiento, toma de caso, IA en pausa) y llamadas del asesor. */
  evento?: "consentimiento" | "toma" | "pausa" | "llamada";
}

/** T22: asesor ficticio de la demo (único sitio donde se define). */
export const ASESOR_DEMO = "Carlos R.";

/** T22: resultado de una llamada del asesor al cliente. */
export type ResultadoLlamada = "contesto" | "no_contesto" | "llamar_luego";
export const RESULTADO_LLAMADA_LABEL: Record<ResultadoLlamada, string> = {
  contesto: "Contestó",
  no_contesto: "No contestó",
  llamar_luego: "Pidió que lo llamen luego",
};

/** T20: «Demo guiada» (guion y pasos para el jurado) o «Modo libre» (como en producción). */
export type DemoMode = "guiada" | "libre";

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
  /** T20 (aditivo): modo de uso de la demo; cambiarlo no borra las conversaciones. */
  demoMode?: DemoMode;
  setDemoMode?(modo: DemoMode): void;
  /** T20 (aditivo): reservas hechas en esta demo (tarjetas «reserva» de cualquier cliente), para la agenda. */
  bookings?: DemoBooking[];
  /** T22 (aditivo): un asesor tomó el caso del cliente elegido; la IA no responde a ese cliente. */
  aiPaused?: boolean;
  /** T22: respuesta escrita por el asesor en la conversación del cliente del caso. */
  replyAsAdvisor?(caseId: string, texto: string): void;
  /** T22: llamada del asesor al cliente del caso (evento en la conversación, no burbuja). */
  logCall?(caseId: string, resultado: ResultadoLlamada, nota: string): void;
}

/** T20: una reserva de la demo y el cliente (escenario) que la hizo. */
export interface DemoBooking {
  scenarioId: ScenarioId;
  booking: Booking;
}

/** T19: lo mínimo que la lista «Clientes de hoy» necesita de cada cliente. */
export interface ClientSnapshot {
  state: AgentState;
  /** El cliente no autorizó contacto por WhatsApp (memoria del agente Proactivo). */
  sinPermisoWhatsapp: boolean;
  /** T22: eligió un seguro y hay un caso «seguro» para un asesor certificado (no bloquea la conversación). */
  seguroElegido?: boolean;
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
  /** T22: acciones del asesor en un caso tomado. */
  onReply?(id: string, texto: string): void;
  onCall?(id: string, resultado: ResultadoLlamada, nota: string): void;
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
