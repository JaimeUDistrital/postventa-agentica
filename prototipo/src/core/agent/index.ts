/**
 * STUB del esqueleto caminante (T00). T08 lo reemplaza por el orquestador real
 * manteniendo la firma `runTurn(request): Promise<AgentTurn>`.
 */
import type { AgentRequest, AgentTurn } from "@/core/contracts";

export async function runTurn(request: AgentRequest): Promise<AgentTurn> {
  const turnId = crypto.randomUUID();
  return {
    sessionId: request.sessionId,
    turnId,
    state: "CONTACTO",
    reply: {
      text: "Hola, soy el asistente de postventa (esqueleto T00). Pronto verás aquí tu propuesta de mantenimiento.",
      cards: [],
    },
    trace: [
      {
        id: `${turnId}-1`,
        ts: new Date().toISOString(),
        kind: "state",
        agent: "Postventa",
        name: "esqueleto",
        system: "CRM",
        autonomy: "informar",
        payload: { escenario: request.scenarioId, tipo: request.tipo },
        latencyMs: 0,
        status: "ok",
        detalle: "Respuesta stub del Paso 0",
      },
    ],
    guardrail: {
      entrada: {
        allow: true,
        action: "permitir",
        categorias: [],
        reasons: [],
        maskedInput: request.message,
        riskScore: 0,
      },
    },
    mode: "deterministic",
    memory: {
      proactivo: { contactosUltimos30Dias: 0, optInWhatsapp: true, motivoContacto: null },
      postventa: {
        turnos: 1,
        estado: "CONTACTO",
        perfilVehiculo: { descripcion: "pendiente", kmEstimado: 0, proximoHitoKm: 0 },
        historialServicios: [],
        cotizacionId: null,
        reservaId: null,
      },
      guardian: { intentosBloqueados: 0, alertas: [] },
      copiloto: { casoAbiertoId: null },
    },
    stateToken: "stub-sin-firma",
  };
}
