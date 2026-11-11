/**
 * Control de acceso al planner Gemini en la demo pública.
 * Por defecto (ADR 0007) la IA atiende a todos los visitantes si hay `GEMINI_API_KEY`; los topes por
 * sesión y por IP siguen aplicando y la clave tiene límites de gasto en su proyecto.
 * Interruptor de emergencia: `GEMINI_SOLO_CON_CODIGO=1` vuelve al modo del ADR 0006, que falla cerrado
 * (sin código configurado, < 12 caracteres o distinto, Gemini queda deshabilitado).
 * El código nunca se registra ni se devuelve.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const LIMITES_DEMO = { maxTurnosSesion: 20, maxPeticionesPorMinutoIp: 30 } as const;

export const LONGITUD_MINIMA_CODIGO = 12;

export type MotivoAcceso = "ok" | "publico" | "sin_clave" | "sin_codigo_configurado" | "codigo_ausente" | "codigo_invalido";

const sha256 = (s: string): Buffer => createHash("sha256").update(s, "utf8").digest();

export function llmHabilitado(args: {
  accessCode: string | undefined;
  env: Record<string, string | undefined>;
}): { habilitado: boolean; motivo: MotivoAcceso } {
  const { accessCode, env } = args;
  if (!env.GEMINI_API_KEY?.trim()) return { habilitado: false, motivo: "sin_clave" };
  if (env.GEMINI_SOLO_CON_CODIGO?.trim() !== "1") return { habilitado: true, motivo: "publico" };
  const configurado = env.DEMO_ACCESS_CODE?.trim() ?? "";
  if (configurado.length < LONGITUD_MINIMA_CODIGO) return { habilitado: false, motivo: "sin_codigo_configurado" };
  if (!accessCode) return { habilitado: false, motivo: "codigo_ausente" };
  // Hash de ambos: longitud fija, así timingSafeEqual no filtra la longitud del código.
  const igual = timingSafeEqual(sha256(accessCode.trim()), sha256(configurado));
  return igual ? { habilitado: true, motivo: "ok" } : { habilitado: false, motivo: "codigo_invalido" };
}
