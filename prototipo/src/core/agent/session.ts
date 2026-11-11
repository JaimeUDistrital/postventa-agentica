/**
 * Memoria de sesión en un token firmado (HMAC-SHA256): el estado viaja con el cliente,
 * así la demo funciona en serverless (cada petición puede ir a otra instancia).
 * Formato: base64url(JSON {s: SessionState, exp}) + "." + base64url(HMAC).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { SessionState, type ScenarioId } from "@/core/contracts";

export const SESION_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_TOKEN = 8000;
const MAX_TEXTO_HISTORIAL = 200;

/**
 * Secreto SOLO para desarrollo y tests. En producción nunca se usa: sin SESSION_SECRET
 * el agente falla cerrado (ConfiguracionError → 500 genérico).
 */
const SECRETO_DESARROLLO = "dev-only-postventa-session-secret-no-usar-en-produccion";

export class SesionInvalidaError extends Error {
  constructor() {
    super("Sesión inválida, reinicie la demo");
    this.name = "SesionInvalidaError";
  }
}

export class ConfiguracionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfiguracionError";
  }
}

export function resolverSecreto(env: Record<string, string | undefined>): string {
  const secreto = env.SESSION_SECRET?.trim();
  if (secreto) return secreto;
  if (env.NODE_ENV === "production") throw new ConfiguracionError("SESSION_SECRET no configurado");
  return SECRETO_DESARROLLO;
}

const Carga = z.object({ s: SessionState, exp: z.number().int() });

const firmar = (carga: string, secret: string): Buffer => createHmac("sha256", secret).update(carga).digest();

function codificar(state: SessionState, secret: string, exp: number): string {
  const carga = Buffer.from(JSON.stringify({ s: state, exp }), "utf8").toString("base64url");
  return `${carga}.${firmar(carga, secret).toString("base64url")}`;
}

/** Firma el estado (historial recortado para no superar MAX_TOKEN). */
export function firmarSesion(state: SessionState, secret: string, nowMs: number): string {
  const historial = state.historial.slice(-12).map((h) => ({ ...h, texto: h.texto.slice(0, MAX_TEXTO_HISTORIAL) }));
  let s: SessionState = { ...state, historial };
  let token = codificar(s, secret, nowMs + SESION_TTL_MS);
  while (token.length > MAX_TOKEN && s.historial.length > 0) {
    s = { ...s, historial: s.historial.slice(1) };
    token = codificar(s, secret, nowMs + SESION_TTL_MS);
  }
  return token;
}

export interface VerificacionSesion {
  secret: string;
  sessionId: string;
  scenarioId: ScenarioId;
  nowMs: number;
}

/** Devuelve el estado si el token es auténtico, vigente y de esta sesión; si no, SesionInvalidaError. */
export function verificarSesion(token: string, v: VerificacionSesion): SessionState {
  const partes = token.split(".");
  if (partes.length !== 2 || token.length > MAX_TOKEN) throw new SesionInvalidaError();
  const [carga, firma] = partes;
  const esperada = firmar(carga, v.secret);
  const recibida = Buffer.from(firma, "base64url");
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) throw new SesionInvalidaError();

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(carga, "base64url").toString("utf8"));
  } catch {
    throw new SesionInvalidaError();
  }
  const parsed = Carga.safeParse(json);
  if (!parsed.success) throw new SesionInvalidaError();
  const { s, exp } = parsed.data;
  if (exp <= v.nowMs || s.sessionId !== v.sessionId || s.scenarioId !== v.scenarioId) throw new SesionInvalidaError();
  return s;
}
