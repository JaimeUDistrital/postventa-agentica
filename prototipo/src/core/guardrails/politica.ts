/** Política de autonomía como código: qué puede hacer el agente sin un humano. */
import type { Autonomy, TraceEvent } from "@/core/contracts";
import { eventoGuardian } from "./traza";

export const ACCIONES_POLITICA = [
  "informar_km",
  "informar_precio",
  "recomendar_paquete",
  "recomendar_venta_cruzada",
  "reservar_bahia",
  "apartar_repuesto",
  "emitir_ot_preliminar",
  "escalar_asesor",
  "diagnosticar_falla",
  "aprobar_garantia",
  "descuento_sobre_tope",
  "cobrar_sin_confirmacion",
  "inventar_precio",
  "revelar_pii_terceros",
] as const;

export type AccionPolitica = (typeof ACCIONES_POLITICA)[number];

export const POLITICA_AUTONOMIA: Readonly<Record<AccionPolitica, Autonomy>> = Object.freeze({
  informar_km: "informar",
  informar_precio: "informar",
  recomendar_paquete: "recomendar",
  recomendar_venta_cruzada: "recomendar",
  reservar_bahia: "ejecutar",
  apartar_repuesto: "ejecutar",
  emitir_ot_preliminar: "ejecutar",
  escalar_asesor: "ejecutar",
  diagnosticar_falla: "prohibido",
  aprobar_garantia: "prohibido",
  descuento_sobre_tope: "prohibido",
  cobrar_sin_confirmacion: "prohibido",
  inventar_precio: "prohibido",
  revelar_pii_terceros: "prohibido",
});

/** Acciones «ejecutar» que no requieren confirmación (llevar el caso a un humano siempre es seguro). */
const EJECUTAR_SIN_CONFIRMACION: ReadonlySet<AccionPolitica> = new Set(["escalar_asesor"]);

export interface Autorizacion {
  permitido: boolean;
  autonomy: Autonomy;
  motivo: string;
  trace: TraceEvent;
}

/**
 * Decide si el agente puede realizar `accion`. Denegación por defecto: una acción
 * desconocida se trata como «prohibido».
 */
export function autorizarAccion(
  accion: AccionPolitica,
  { confirmadoPorCliente }: { confirmadoPorCliente: boolean },
): Autorizacion {
  const conocida = Object.prototype.hasOwnProperty.call(POLITICA_AUTONOMIA, accion);
  const autonomy: Autonomy = conocida ? POLITICA_AUTONOMIA[accion] : "prohibido";

  let permitido: boolean;
  let motivo: string;
  if (autonomy === "prohibido") {
    permitido = false;
    motivo = `«${accion}» está prohibida para el agente: solo la decide una persona (asesor o gerencia).`;
  } else if (autonomy === "ejecutar" && !EJECUTAR_SIN_CONFIRMACION.has(accion) && !confirmadoPorCliente) {
    permitido = false;
    motivo = `«${accion}» modifica sistemas reales: requiere confirmación explícita del cliente.`;
  } else {
    permitido = true;
    motivo =
      autonomy === "ejecutar"
        ? `«${accion}» autorizada (nivel ejecutar${EJECUTAR_SIN_CONFIRMACION.has(accion) ? ", sin confirmación: escalar a humano siempre es seguro" : ", confirmada por el cliente"}).`
        : `«${accion}» autorizada (nivel ${autonomy}).`;
  }

  const trace = eventoGuardian({
    kind: "policy",
    name: `politica_${accion}`,
    status: permitido ? "ok" : "blocked",
    autonomy,
    detalle: motivo,
    payload: { accion, autonomy, confirmadoPorCliente, permitido },
  });
  return { permitido, autonomy, motivo, trace };
}
