/**
 * Guardián (T04): guardrails deterministas, sin LLM; el LLM no puede anularlos.
 *
 * API para el orquestador (T08):
 * - `evaluarEntrada({ message, tipo, optInWhatsapp, intentosBloqueados })`
 *     → `{ verdict, sintomas, trace }`. Reglas en orden: consentimiento, límite de
 *     intentos, inyección, fraude, síntomas críticos, PII. `verdict.allow` es true solo
 *     con acción «permitir» o «enmascarar». Con «escalar», crear HandoffCase
 *     (motivo `sintoma_critico`) con `sintomas`. El LLM solo ve `verdict.maskedInput`.
 * - `validarSalida({ text, cotizacionTotalUsd?, totalRecalculadoUsd?, descuentoPct? })`
 *     → `{ verdict, trace }`. Si `allow` es false, no mostrar `text`: usar respuesta segura.
 *     Si se pasa `cotizacionTotalUsd`, pasar también `totalRecalculadoUsd` (si no, bloquea).
 * - `autorizarAccion(accion, { confirmadoPorCliente })` → `{ permitido, autonomy, motivo, trace }`
 *     antes de cada herramienta; `POLITICA_AUTONOMIA` es la tabla acción → nivel.
 * - `maskPII(text)` y `maskPayload(obj)` para cualquier dato que vaya a traza o al LLM.
 * Todas las trazas: agent/system «Guardián», payload enmascarado, `detalle` legible.
 */
export { evaluarEntrada, type EntradaGuardian, type ResultadoEntrada } from "./entrada";
export { validarSalida, type SalidaGuardian } from "./salida";
export {
  ACCIONES_POLITICA,
  POLITICA_AUTONOMIA,
  autorizarAccion,
  type AccionPolitica,
  type Autorizacion,
} from "./politica";
export { maskPII, maskPayload, type TipoPII } from "./pii";
