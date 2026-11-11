/** Intención del cliente: las acciones de botón mandan sobre el texto libre (palabras clave). */
import type { AgentRequest, UserAction } from "@/core/contracts";

export type Intencion =
  | "inicio"
  | "precio"
  | "venta_cruzada"
  | "rechazar_venta_cruzada"
  | "agendar"
  | "confirmar"
  | "seguros"
  | "asesor"
  | "otro";

const POR_ACCION: Record<UserAction, Intencion> = {
  aceptar_mantenimiento: "agendar",
  agregar_venta_cruzada: "venta_cruzada",
  rechazar_venta_cruzada: "rechazar_venta_cruzada",
  confirmar_reserva: "confirmar",
  ver_seguros: "seguros",
  hablar_con_asesor: "asesor",
};

/** Orden = prioridad: la primera regla que coincide gana. */
const REGLAS: readonly [Intencion, RegExp][] = [
  // T21: solo pedidos explícitos de llamada («¿me pueden llamar?»); «llámeme si hay novedades» no es un pase a humano (eval P03).
  [
    "asesor",
    /\b(asesor|humano|una persona|molest|queja|enojad|furios)|\b(?:pueden|puede|podrian|podria)\s+(?:me\s+)?(?:llamar|contactar)\b|\b(?:quiero|necesito)\s+que\s+me\s+(?:llamen|contacten|llame|contacte)\b/,
  ],
  ["confirmar", /\bconfirm/],
  ["rechazar_venta_cruzada", /\bno (gracias|quiero|me interesa)\b|\bsin (el )?paquete\b/],
  ["venta_cruzada", /(freno|pastilla|bateria|llanta|alineac|balanceo|agregue|agrega|anad)/],
  ["seguros", /\b(seguro|seguros|soat|poliza)\b/],
  ["precio", /(precio|cuanto|cuesta|valor|cotiz)/],
  ["agendar", /(agend|reserv|\bcita\b|^\s*si\b|\bsi,|\bsi quiero\b|\bme interesa\b)/],
];

export const normalizar = (t: string): string =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function detectarIntencion(request: AgentRequest, maskedMessage: string): Intencion {
  if (request.tipo === "inicio") return "inicio";
  if (request.accion) return POR_ACCION[request.accion];
  const texto = normalizar(maskedMessage);
  return REGLAS.find(([, re]) => re.test(texto))?.[0] ?? "otro";
}

/** Solo estas intenciones cuentan como confirmación explícita del cliente para reservar. */
export const confirmaReserva = (i: Intencion): boolean => i === "agendar" || i === "confirmar";

/** Ítem de venta cruzada del tarifario según el texto (por defecto, pastillas de freno). */
export function extraVentaCruzada(maskedMessage: string): string {
  const t = normalizar(maskedMessage);
  if (/bateria/.test(t)) return "VC-BAT-01";
  if (/(llanta|alineac|balanceo)/.test(t)) return "VC-ALI-01";
  return "VC-PAS-01";
}
