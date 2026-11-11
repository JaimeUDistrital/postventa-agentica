/** T19 · Estado de cada cliente en palabras, derivado de su último AgentState conocido. */
import type { ClientSnapshot } from "@/ui/contracts";

export type EstadoCliente =
  | "pendiente"
  | "conversando"
  | "cita_apartada"
  | "cita_confirmada"
  | "necesita_asesor"
  | "bloqueado"
  | "sin_permiso";

export const ESTADO_CLIENTE_LABEL: Record<EstadoCliente, string> = {
  pendiente: "Pendiente",
  conversando: "Conversando",
  cita_apartada: "Cita apartada",
  cita_confirmada: "Cita confirmada",
  necesita_asesor: "¡Necesita asesor!",
  bloqueado: "Bloqueado por seguridad",
  sin_permiso: "Sin permiso de contacto",
};

export function estadoCliente(s: ClientSnapshot | undefined): EstadoCliente {
  if (!s) return "pendiente";
  switch (s.state) {
    case "HANDOFF":
      return "necesita_asesor";
    case "BLOQUEADO":
      return "bloqueado";
    case "CONFIRMACION":
      return "cita_apartada";
    case "CERRADO":
      return "cita_confirmada";
    case "TRIGGER":
    case "CONTACTO":
      // Sin opt-in el agente no inicia la conversación: queda detenido en el disparador.
      return s.sinPermisoWhatsapp ? "sin_permiso" : "conversando";
    default:
      return "conversando";
  }
}
