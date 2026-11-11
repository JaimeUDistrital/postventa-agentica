/**
 * Control de acceso al planner Gemini en la demo pública (ADR 0006). Falla cerrado: sin clave,
 * sin código configurado (o < 12 caracteres) o con código distinto, Gemini queda deshabilitado.
 * El código nunca se registra ni se devuelve.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const LIMITES_DEMO = { maxTurnosSesion: 20, maxPeticionesPorMinutoIp: 30 } as const;

export const LONGITUD_MINIMA_CODIGO = 12;

export type MotivoAcceso = "ok" | "sin_clave" | "sin_codigo_configurado" | "codigo_ausente" | "codigo_invalido";

const sha256 = (s: string): Buffer => createHash("sha256").update(s, "utf8").digest();

export function llmHabilitado(args: {
  accessCode: string | undefined;
  env: Record<string, string | undefined>;
}): { habilitado: boolean; motivo: MotivoAcceso } {
  const { accessCode, env } = args;
  if (!env.GEMINI_API_KEY?.trim()) return { habilitado: false, motivo: "sin_clave" };
  const configurado = env.DEMO_ACCESS_CODE?.trim() ?? "";
  if (configurado.length < LONGITUD_MINIMA_CODIGO) return { habilitado: false, motivo: "sin_codigo_configurado" };
  if (!accessCode) return { habilitado: false, motivo: "codigo_ausente" };
  // Hash de ambos: longitud fija, así timingSafeEqual no filtra la longitud del código.
  const igual = timingSafeEqual(sha256(accessCode.trim()), sha256(configurado));
  return igual ? { habilitado: true, motivo: "ok" } : { habilitado: false, motivo: "codigo_invalido" };
}
