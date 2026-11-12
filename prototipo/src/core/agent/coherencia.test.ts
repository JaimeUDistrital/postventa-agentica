/**
 * T21 · Coherencia conversacional del planner determinista.
 * Cada caso reproduce un hallazgo del QA exploratorio contra la API en vivo (2026-11-11):
 * menús repetidos tras un handoff, regresión de estado tras cerrar la cita y acciones en bucle.
 */
import { describe, expect, it } from "vitest";
import type { AgentRequest, AgentTurn, ScenarioId } from "@/core/contracts";
import { DEMO_NOW } from "@/core/config";
import { createMockPorts } from "@/core/adapters/mock";
import { fixtures } from "@/core/data";
import type { Planner } from "@/core/ports";
import { createAgent, plannerDeterminista } from "./index";

const SECRET = "secreto-de-prueba-0123456789abcdef";
type Paso = Partial<Omit<AgentRequest, "sessionId" | "scenarioId" | "stateToken">>;

async function conversar(scenarioId: ScenarioId, pasos: Paso[]): Promise<AgentTurn[]> {
  const turnos: AgentTurn[] = [];
  let stateToken: string | undefined;
  for (const p of pasos) {
    const agente = createAgent({ ports: createMockPorts(fixtures), planner: plannerDeterminista, now: DEMO_NOW, secret: SECRET });
    const t = await agente.runTurn({ sessionId: `coh-${scenarioId}`, scenarioId, tipo: "mensaje", message: "", ...p, stateToken });
    stateToken = t.stateToken;
    turnos.push(t);
  }
  return turnos;
}

const tools = (t: AgentTurn) => t.trace.filter((e) => e.kind === "tool_call").map((e) => e.name);
const tipos = (t: AgentTurn) => t.reply.cards.map((c) => c.type);
const MENU = "Puedo ayudarle a agendar";
const INICIO: Paso = { tipo: "inicio" };
const msg = (message: string): Paso => ({ tipo: "mensaje", message });
const acc = (accion: NonNullable<AgentRequest["accion"]>): Paso => ({ tipo: "accion", accion });
const CITA_CERRADA: Paso[] = [INICIO, acc("aceptar_mantenimiento"), acc("confirmar_reserva")];

describe("T21 · tras pasar el caso a un asesor (HANDOFF)", () => {
  it("un mensaje cualquiera no ofrece el menú de agendar, no llama herramientas y sigue en HANDOFF", async () => {
    const t = (await conversar("feliz", [INICIO, acc("hablar_con_asesor"), msg("hola?")])).at(-1)!;
    expect(t.state).toBe("HANDOFF");
    expect(t.reply.text).not.toContain(MENU);
    expect(t.reply.text).toMatch(/asesor/i);
    expect(tools(t)).toEqual([]);
  });
});

describe("T21 · con la cita ya confirmada (CERRADO)", () => {
  it("«gracias» no vuelve a ofrecer agendar y el estado sigue CERRADO", async () => {
    const t = (await conversar("feliz", [...CITA_CERRADA, msg("gracias")])).at(-1)!;
    expect(CITA_CERRADA.length).toBe(3);
    expect(t.state).toBe("CERRADO");
    expect(t.reply.text).not.toContain(MENU);
  });

  it("preguntar el precio no devuelve el estado a COTIZACION ni agenda otra vez", async () => {
    const t = (await conversar("feliz", [...CITA_CERRADA, msg("cuánto me costó?")])).at(-1)!;
    expect(t.state).toBe("CERRADO");
    expect(tools(t)).not.toContain("agendar_bahia_taller");
  });

  it("pedir cambiar la cita remite a un asesor humano", async () => {
    const t = (await conversar("feliz", [...CITA_CERRADA, msg("quiero cambiar la cita para el viernes")])).at(-1)!;
    expect(["CERRADO", "HANDOFF"]).toContain(t.state);
    expect(t.reply.text).toMatch(/asesor/i);
    expect(t.reply.text).not.toBe("Su reserva ya quedó registrada. ¡Le esperamos!");
  });
});

describe("T21 · acciones repetidas", () => {
  it("ver seguros por segunda vez no repite la consulta ni las mismas ofertas", async () => {
    const [, primera, segunda] = await conversar("feliz", [INICIO, acc("ver_seguros"), acc("ver_seguros")]);
    expect(tipos(primera)).toContain("seguro");
    expect(tools(segunda)).not.toContain("cotizar_aliados_seguros");
    expect(tipos(segunda)).not.toContain("seguro");
    expect(segunda.reply.text).not.toBe(primera.reply.text);
  });
});

describe("T21 · texto libre", () => {
  it("«me pueden llamar?» pasa el caso a un asesor", async () => {
    const t = (await conversar("feliz", [INICIO, msg("me pueden llamar?")])).at(-1)!;
    expect(t.state).toBe("HANDOFF");
    expect(t.handoff).toBeDefined();
  });

  it("el primer mensaje sin intención clara ofrece opciones y la salida a un asesor", async () => {
    const [, uno] = await conversar("feliz", [INICIO, msg("hola")]);
    expect(uno.state).toBe("COTIZACION");
    expect(uno.reply.text).toMatch(/asesor/i);
    expect(uno.handoff).toBeUndefined();
  });

  it("el segundo mensaje seguido sin intención clara pasa el caso a un humano (no_resuelto)", async () => {
    const [, uno, dos] = await conversar("feliz", [INICIO, msg("hola"), msg("no entiendo")]);
    expect(dos.reply.text).not.toBe(uno.reply.text);
    expect(dos.state).toBe("HANDOFF");
    expect(dos.handoff?.motivo).toBe("no_resuelto");
  });
});

describe("T21 · elegir un seguro", () => {
  it("«el 1» tras ver las ofertas abre un caso de venta de seguro sin bloquear la conversación", async () => {
    const [, ofertas, eleccion] = await conversar("feliz", [INICIO, acc("ver_seguros"), msg("el 1")]);
    const card = ofertas.reply.cards.find((c) => c.type === "seguro");
    if (card?.type !== "seguro") throw new Error("no hubo tarjeta de seguros");
    const primera = card.ofertas[0];
    expect(eleccion.handoff?.motivo).toBe("seguro");
    expect(eleccion.state).not.toBe("HANDOFF");
    expect(eleccion.reply.text).toContain(primera.aseguradora);
    expect(eleccion.reply.text).toContain(primera.producto);
    expect(eleccion.reply.text).not.toContain(MENU);
    expect(eleccion.reply.text).not.toMatch(/comisi/i);
  });

  it("«quiero la opción 2» elige la segunda oferta", async () => {
    const [, ofertas, eleccion] = await conversar("feliz", [INICIO, acc("ver_seguros"), msg("quiero la opción 2")]);
    const card = ofertas.reply.cards.find((c) => c.type === "seguro");
    if (card?.type !== "seguro") throw new Error("no hubo tarjeta de seguros");
    expect(eleccion.handoff?.motivo).toBe("seguro");
    expect(eleccion.reply.text).toContain(card.ofertas[1].aseguradora);
  });

  it("después de elegir el seguro el cliente aún puede agendar su mantenimiento", async () => {
    const ts = await conversar("feliz", [INICIO, acc("ver_seguros"), msg("el 1"), acc("aceptar_mantenimiento")]);
    const t = ts.at(-1)!;
    expect(t.state).toBe("CONFIRMACION");
    expect(tipos(t)).toContain("reserva");
  });

  it("«es la primera vez que voy» tras ver ofertas no se interpreta como elegir la opción 1", async () => {
    const t = (await conversar("feliz", [INICIO, acc("ver_seguros"), msg("es la primera vez que voy al taller")])).at(-1)!;
    expect(t.handoff?.motivo).not.toBe("seguro");
  });

  it("«el 1» sin haber visto ofertas no se interpreta como compra de seguro", async () => {
    const t = (await conversar("feliz", [INICIO, msg("el 1")])).at(-1)!;
    expect(t.handoff?.motivo).not.toBe("seguro");
  });
});

describe("Paquete y seguros explicados al cliente con datos verificados", () => {
  const cotizacion = (t: AgentTurn) => {
    const c = t.reply.cards.find((x) => x.type === "cotizacion");
    if (c?.type !== "cotizacion") throw new Error("sin cotización");
    return c;
  };

  it("la cotización inicial trae el paquete sugerido con su descripción del tarifario", async () => {
    const [t] = await conversar("feliz", [INICIO]);
    expect(cotizacion(t).paquete).toMatchObject({ tariffId: "VC-PAS-01", descripcion: "Revisión y cambio de pastillas de freno delanteras" });
  });

  it("el «+ precio» del paquete es exactamente lo que sube el total al agregarlo", async () => {
    const [ini, con] = await conversar("feliz", [INICIO, acc("agregar_venta_cruzada")]);
    const antes = cotizacion(ini);
    expect(antes.paquete?.precioUsd).toBeGreaterThan(0);
    expect(cotizacion(con).quote.totalUsd - antes.quote.totalUsd).toBeCloseTo(antes.paquete!.precioUsd, 2);
  });

  it("con el paquete ya agregado, la cotización no lo vuelve a sugerir", async () => {
    const [, con] = await conversar("feliz", [INICIO, acc("agregar_venta_cruzada")]);
    expect(cotizacion(con).paquete).toBeUndefined();
  });

  it("la tarjeta de seguros dice cuándo vence el SOAT y si hay póliza, según la herramienta", async () => {
    const [, t] = await conversar("feliz", [INICIO, acc("ver_seguros")]);
    const c = t.reply.cards.find((x) => x.type === "seguro");
    if (c?.type !== "seguro") throw new Error("sin seguros");
    const v = fixtures.vehicles.find((x) => x.id === "veh-01")!;
    expect(c.soat?.vence).toBe(v.vencimientoSoat);
    expect(Number.isInteger(c.soat?.dias)).toBe(true);
    expect(c.polizaVence).toBe(v.vencimientoPoliza);
  });
});

describe("QA en vivo · el planner agota sus pasos sin respuesta final", () => {
  it("si promete un asesor, abre el caso de verdad (no_resuelto) y pasa a HANDOFF", async () => {
    const enBucle: Planner = {
      mode: "llm",
      next: async () => ({
        step: { kind: "tool_calls", rationale: "bucle", calls: [{ id: "c", tool: "consultar_contexto_vehiculo", args: { vehicleId: "veh-01" } }] },
      }),
    };
    const [inicio] = await conversar("feliz", [INICIO]);
    const agente = createAgent({ ports: createMockPorts(fixtures), planner: enBucle, now: DEMO_NOW, secret: SECRET });
    const t = await agente.runTurn({ sessionId: "coh-feliz", scenarioId: "feliz", tipo: "mensaje", message: "hola", stateToken: inicio.stateToken });
    expect(t.reply.text).toMatch(/asesor/i);
    expect(t.handoff?.motivo).toBe("no_resuelto");
    expect(t.state).toBe("HANDOFF");
  });
});
