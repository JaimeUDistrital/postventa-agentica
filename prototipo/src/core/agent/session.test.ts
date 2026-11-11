import { describe, expect, it } from "vitest";
import type { SessionState } from "@/core/contracts";
import {
  ConfiguracionError,
  SESION_TTL_MS,
  SesionInvalidaError,
  firmarSesion,
  resolverSecreto,
  verificarSesion,
} from "./session";

const SECRET = "secreto-de-prueba-0123456789abcdef";
const T0 = Date.parse("2026-11-12T09:00:00Z");

const estado = (over: Partial<SessionState> = {}): SessionState => ({
  sessionId: "s-1",
  scenarioId: "feliz",
  vehicleId: "veh-01",
  state: "COTIZACION",
  turnos: 1,
  intentosBloqueados: 0,
  quoteId: null,
  bookingId: null,
  ventaCruzada: "pendiente",
  casoAbiertoId: null,
  historial: [],
  ...over,
});

const opts = (over: Partial<Parameters<typeof verificarSesion>[1]> = {}) => ({
  secret: SECRET,
  sessionId: "s-1",
  scenarioId: "feliz" as const,
  nowMs: T0 + 1000,
  ...over,
});

describe("token de sesión firmado (HMAC-SHA256)", () => {
  it("ida y vuelta: lo firmado se verifica y devuelve el mismo estado", () => {
    const token = firmarSesion(estado(), SECRET, T0);
    expect(verificarSesion(token, opts())).toEqual(estado());
  });

  it("rechaza un token con la carga alterada", () => {
    const token = firmarSesion(estado(), SECRET, T0);
    const [carga, firma] = token.split(".");
    const alterada = Buffer.from(
      Buffer.from(carga, "base64url").toString("utf8").replace('"turnos":1', '"turnos":9'),
    ).toString("base64url");
    expect(() => verificarSesion(`${alterada}.${firma}`, opts())).toThrow(SesionInvalidaError);
  });

  it("rechaza una firma alterada o un token sin formato", () => {
    const token = firmarSesion(estado(), SECRET, T0);
    expect(() => verificarSesion(`${token}x`, opts())).toThrow(SesionInvalidaError);
    expect(() => verificarSesion("basura", opts())).toThrow(SesionInvalidaError);
    expect(() => verificarSesion("", opts())).toThrow(SesionInvalidaError);
  });

  it("rechaza un token firmado con otro secreto", () => {
    const token = firmarSesion(estado(), "otro-secreto-xxxxxxxxxxxxxxxxxxxx", T0);
    expect(() => verificarSesion(token, opts())).toThrow(SesionInvalidaError);
  });

  it("rechaza un token caducado (2 h)", () => {
    const token = firmarSesion(estado(), SECRET, T0);
    expect(() => verificarSesion(token, opts({ nowMs: T0 + SESION_TTL_MS + 1 }))).toThrow(SesionInvalidaError);
  });

  it("rechaza un token de otra sesión o de otro escenario", () => {
    const token = firmarSesion(estado(), SECRET, T0);
    expect(() => verificarSesion(token, opts({ sessionId: "s-2" }))).toThrow(SesionInvalidaError);
    expect(() => verificarSesion(token, opts({ scenarioId: "adversarial" }))).toThrow(SesionInvalidaError);
  });

  it("el mensaje de error no revela detalles internos", () => {
    try {
      verificarSesion("a.b", opts());
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).toBe("Sesión inválida, reinicie la demo");
    }
  });

  it("nunca supera 8000 caracteres aunque el historial sea largo", () => {
    const largo = "x".repeat(1000);
    const historial = Array.from({ length: 12 }, () => ({ rol: "cliente" as const, texto: largo }));
    const token = firmarSesion(estado({ historial }), SECRET, T0);
    expect(token.length).toBeLessThanOrEqual(8000);
    expect(verificarSesion(token, opts()).historial.length).toBe(12);
  });
});

describe("resolverSecreto", () => {
  it("usa SESSION_SECRET cuando existe", () => {
    expect(resolverSecreto({ SESSION_SECRET: "abc", NODE_ENV: "production" })).toBe("abc");
  });

  it("en producción sin secreto falla cerrado", () => {
    expect(() => resolverSecreto({ NODE_ENV: "production" })).toThrow(ConfiguracionError);
    expect(() => resolverSecreto({ NODE_ENV: "production", SESSION_SECRET: "  " })).toThrow(ConfiguracionError);
  });

  it("en desarrollo/test sin secreto usa un secreto de desarrollo fijo", () => {
    const a = resolverSecreto({ NODE_ENV: "test" });
    expect(a.length).toBeGreaterThan(16);
    expect(resolverSecreto({})).toBe(a);
  });
});
