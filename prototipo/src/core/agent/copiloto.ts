/** Copiloto del asesor: resumen del caso por plantilla (sin LLM, sin PII). */
import type { HandoffReason, ServiceRecord } from "@/core/contracts";
import { maskPII } from "@/core/guardrails";

const MOTIVO: Record<HandoffReason, string> = {
  sintoma_critico: "síntoma crítico de seguridad",
  sin_stock: "repuesto sin stock para el mantenimiento",
  adversarial: "intento de manipulación o fraude (revisión)",
  garantia: "consulta de garantía",
  cliente_molesto: "el cliente pide un asesor humano",
};

const SIGUIENTE: Record<HandoffReason, string> = {
  sintoma_critico: "llamar al cliente de inmediato, pedirle no conducir y ofrecer grúa o revisión prioritaria",
  sin_stock: "confirmar la fecha de reposición y agendar en una de las franjas propuestas",
  adversarial: "revisar la conversación y responder con la política vigente, sin ceder",
  garantia: "validar la cobertura con el concesionario antes de prometer nada",
  cliente_molesto: "contactar al cliente con tono empático y ofrecer una solución concreta",
};

export interface DatosResumen {
  motivo: HandoffReason;
  sintomas: string[];
  vehiculo: string;
  kmEstimado: number;
  historial: ServiceRecord[];
  nota?: string;
}

export function resumenCopiloto(d: DatosResumen): string {
  const ultimo = [...d.historial].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1);
  const historial = ultimo
    ? `${d.historial.length} servicio(s); último ${ultimo.fecha}: ${ultimo.servicio} (${ultimo.km} km, ${ultimo.enAgencia ? "en agencia" : "fuera de la agencia"})`
    : "sin servicios registrados";
  const nota = d.nota ? ` Nota del agente: ${maskPII(d.nota).masked}.` : "";
  return (
    `Motivo: ${MOTIVO[d.motivo]}. Síntomas: ${d.sintomas.join(", ") || "ninguno reportado"}. ` +
    `Vehículo: ${d.vehiculo}, ~${d.kmEstimado} km. Historial: ${historial}.${nota} ` +
    `Siguiente paso sugerido: ${SIGUIENTE[d.motivo]}.`
  );
}
