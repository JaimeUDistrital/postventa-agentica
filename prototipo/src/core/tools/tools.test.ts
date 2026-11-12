import { describe, expect, it } from "vitest";
import type { ToolContext } from "@/core/ports";
import { TraceEvent } from "@/core/contracts";
import { createMockPorts } from "@/core/adapters/mock";
import { testFixtures } from "@/core/adapters/mock/test-fixtures";
import { estimarKm, executeTool, parseQuoteId } from "./index";

const NOW = "2026-11-12T09:00";
const mkCtx = (): ToolContext => ({ ports: createMockPorts(testFixtures(), { now: NOW }), now: NOW });

const agendar = (ctx: ToolContext, over: Record<string, unknown> = {}) =>
  executeTool(
    "agendar_bahia_taller",
    {
      vehicleId: "v_cx30",
      quoteId: "q_v_cx30_10000__0",
      idempotencyKey: "idem-1234",
      confirmadoPorCliente: true,
      ...over,
    },
    ctx,
  );

describe("estimarKm", () => {
  it("proyecta km, hito, días y garantía", async () => {
    const ctx = mkCtx();
    const v = await ctx.ports.crm.getVehicle("v_cx30");
    expect(v).toBeDefined();
    expect(estimarKm(v!, NOW)).toEqual({ kmEstimado: 9550, proximoHitoKm: 10000, diasParaHito: 9, enGarantia: true });
  });

  it("si el km cae justo en múltiplo, el hito es el siguiente", async () => {
    const ctx = mkCtx();
    const v = { ...(await ctx.ports.crm.getVehicle("v_cx30"))!, kmUltimoRegistro: 10000, fechaUltimoRegistro: "2026-11-12" };
    expect(estimarKm(v, NOW).proximoHitoKm).toBe(20000);
  });
});

describe("consultar_contexto_vehiculo", () => {
  it("devuelve contexto con alias sin PII y traza del agente Proactivo", async () => {
    const r = await executeTool("consultar_contexto_vehiculo", { vehicleId: "v_cx30" }, mkCtx());
    expect(r.ok).toBe(true);
    const out = r.output as { clienteAlias: string; kmEstimado: number; enGarantia: boolean };
    expect(out.clienteAlias).toBe("Laura G.");
    expect(out.kmEstimado).toBe(9550);
    expect(r.trace.map((t) => t.kind)).toEqual(["tool_call", "tool_result"]);
    expect(r.trace.every((t) => t.agent === "Proactivo" && t.system === "CRM")).toBe(true);
    expect(r.trace[1].latencyMs).toBe(120);
    r.trace.forEach((t) => expect(TraceEvent.safeParse(t).success).toBe(true));
    const s = JSON.stringify(r.trace);
    expect(s).not.toMatch(/1020304050|3001234567|laura@example/);
  });

  it("vehículo inexistente → ok:false sin lanzar", async () => {
    const r = await executeTool("consultar_contexto_vehiculo", { vehicleId: "nope" }, mkCtx());
    expect(r.ok).toBe(false);
    expect(r.error).toBe("vehiculo_no_encontrado");
    expect(r.trace.at(-1)?.status).toBe("error");
  });
});

describe("entrada inválida", () => {
  it("devuelve ok:false con error claro y traza", async () => {
    const r = await executeTool("verificar_stock_y_precio", { vehicleId: "" }, mkCtx());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/^entrada_invalida/);
    expect(r.trace).toHaveLength(2);
    expect(r.trace[1].status).toBe("error");
  });

  it("args que no son objeto tampoco lanzan", async () => {
    const r = await executeTool("cotizar_aliados_seguros", "hola", mkCtx());
    expect(r.ok).toBe(false);
    expect(r.trace[0].payload).toEqual({ args: "hola" });
  });
});

describe("verificar_stock_y_precio · venta cruzada sugerida", () => {
  it("no sugiere lo que el mantenimiento ya incluye (40.000 km ya trae pastillas delanteras)", async () => {
    const { fixtures } = await import("@/core/data");
    const ctx: ToolContext = { ports: createMockPorts(fixtures, { now: NOW }), now: NOW };
    const ids = async (hitoKm: number) => {
      const r = await executeTool("verificar_stock_y_precio", { vehicleId: "veh-01", hitoKm }, ctx);
      return (r.output as { ventaCruzadaSugerida: { tariffId: string }[] }).ventaCruzadaSugerida.map((x) => x.tariffId);
    };
    expect(await ids(40000)).not.toContain("VC-PAS-01");
    expect(await ids(30000)).toContain("VC-PAS-01");
  });
});

describe("verificar_stock_y_precio", () => {
  it("precio solo del tarifario: mano de obra + repuestos × cantidad", async () => {
    const r = await executeTool("verificar_stock_y_precio", { vehicleId: "v_cx30", hitoKm: 10000 }, mkCtx());
    expect(r.ok).toBe(true);
    const out = r.output as { cotizacion: { subtotalUsd: number; totalUsd: number; id: string; fuente: string }; todosDisponibles: boolean; ventaCruzadaSugerida: { tariffId: string }[] };
    expect(out.cotizacion.subtotalUsd).toBe(30 + 2 * 20 + 10); // 80
    expect(out.cotizacion.totalUsd).toBe(80);
    expect(out.cotizacion.fuente).toBe("tarifario");
    expect(out.cotizacion.id).toBe("q_v_cx30_10000__0");
    expect(out.todosDisponibles).toBe(true);
    expect(out.ventaCruzadaSugerida.map((x) => x.tariffId).sort()).toEqual(["t_alineacion", "t_frenos"]);
    expect(r.trace.map((t) => [t.kind, t.system])).toEqual([
      ["tool_call", "Inventario"],
      ["tool_result", "Inventario"],
      ["tool_result", "Tarifario"],
    ]);
    expect(r.trace[1].latencyMs).toBe(180);
    expect(r.trace[2].latencyMs).toBe(90);
  });

  it("suma la venta cruzada y aplica descuento dentro del tope", async () => {
    const r = await executeTool(
      "verificar_stock_y_precio",
      { vehicleId: "v_cx30", hitoKm: 10000, extras: ["t_frenos", "t_alineacion"], descuentoPct: 0.05 },
      mkCtx(),
    );
    const out = r.output as { cotizacion: { subtotalUsd: number; totalUsd: number; id: string }; ventaCruzadaSugerida: unknown[] };
    // 80 + (25+40) + 35 = 180; -5 % = 171
    expect(out.cotizacion.subtotalUsd).toBe(180);
    expect(out.cotizacion.totalUsd).toBe(171);
    expect(out.cotizacion.id).toBe("q_v_cx30_10000_t_frenos+t_alineacion_0.05");
    expect(out.ventaCruzadaSugerida).toHaveLength(0);
  });

  it("descuento > tope → ok:false descuento_fuera_de_politica y traza blocked", async () => {
    const r = await executeTool("verificar_stock_y_precio", { vehicleId: "v_cx30", hitoKm: 10000, descuentoPct: 0.2 }, mkCtx());
    expect(r.ok).toBe(false);
    expect(r.error).toBe("descuento_fuera_de_politica");
    expect(r.trace.at(-1)?.status).toBe("blocked");
  });

  it("stock 0 marca todosDisponibles=false con fecha de reposición", async () => {
    const r = await executeTool("verificar_stock_y_precio", { vehicleId: "v_duster", hitoKm: 20000 }, mkCtx());
    const out = r.output as { todosDisponibles: boolean; disponibilidad: { disponible: boolean; fechaReposicion: string | null }[] };
    expect(out.todosDisponibles).toBe(false);
    expect(out.disponibilidad[0]).toMatchObject({ disponible: false, fechaReposicion: "2026-11-20" });
  });

  it("hito sin tarifa y extra inválido → ok:false", async () => {
    const a = await executeTool("verificar_stock_y_precio", { vehicleId: "v_cx30", hitoKm: 30000 }, mkCtx());
    expect(a.error).toBe("tarifa_no_encontrada");
    const b = await executeTool("verificar_stock_y_precio", { vehicleId: "v_cx30", hitoKm: 10000, extras: ["t_cx30_10000"] }, mkCtx());
    expect(b.error).toBe("extra_invalido");
  });
});

describe("parseQuoteId", () => {
  it("decodifica ids con guiones bajos y sin extras", () => {
    expect(parseQuoteId("q_v_cx30_10000_t_frenos+t_alineacion_0.05")).toEqual({
      vehicleId: "v_cx30", hitoKm: 10000, extras: ["t_frenos", "t_alineacion"], descuentoPct: 0.05,
    });
    expect(parseQuoteId("q_v_cx30_10000__0")).toEqual({ vehicleId: "v_cx30", hitoKm: 10000, extras: [], descuentoPct: 0 });
    expect(parseQuoteId("basura")).toBeNull();
  });
});

describe("agendar_bahia_taller", () => {
  it("sin confirmación → requiere_confirmacion + 3 alternativas valle", async () => {
    const r = await agendar(mkCtx(), { confirmadoPorCliente: false });
    const out = r.output as { estado: string; booking: unknown; alternativas: { franja: string }[] };
    expect(out.estado).toBe("requiere_confirmacion");
    expect(out.booking).toBeNull();
    expect(out.alternativas).toHaveLength(3);
    expect(out.alternativas.every((s) => s.franja === "valle")).toBe(true);
  });

  it("confirmado → reserva la primera franja valle libre con hold y repuestos", async () => {
    const ctx = mkCtx();
    const r = await agendar(ctx);
    const out = r.output as { estado: string; booking: { slotId: string; holdHasta: string; repuestosApartados: string[]; estado: string } };
    expect(out.estado).toBe("reservada");
    expect(out.booking.slotId).toBe("b2");
    expect(out.booking.holdHasta).toBe("2026-11-12T09:15");
    expect(out.booking.repuestosApartados.sort()).toEqual(["P-ACE", "P-FIL"]);
    expect((await ctx.ports.workshop.listSlots({ desde: NOW, franja: "valle", limite: 1 }))[0].id).toBe("b4");
    expect(r.trace[0].system).toBe("Taller");
    expect(r.trace[0].autonomy).toBe("ejecutar");
    expect(r.trace[1].latencyMs).toBe(220);
  });

  it("doble reserva con la misma idempotencyKey devuelve la misma reserva", async () => {
    const ctx = mkCtx();
    const a = await agendar(ctx);
    const b = await agendar(ctx);
    expect((b.output as { booking: unknown }).booking).toEqual((a.output as { booking: unknown }).booking);
    const libres = await ctx.ports.workshop.listSlots({ desde: NOW, franja: "valle" });
    expect(libres.filter((s) => s.id === "b4")).toHaveLength(1); // solo se consumió b2
  });

  it("slotId explícito se respeta; ocupado → sin_disponibilidad con alternativas", async () => {
    const ctx = mkCtx();
    const ok = await agendar(ctx, { slotId: "b4" });
    expect((ok.output as { booking: { slotId: string } }).booking.slotId).toBe("b4");
    const ocupado = await agendar(ctx, { slotId: "b4", idempotencyKey: "idem-9999" });
    expect((ocupado.output as { estado: string }).estado).toBe("sin_disponibilidad");
  });

  it("sin franjas libres → sin_disponibilidad y alternativas vacías", async () => {
    const f = testFixtures();
    f.bays = f.bays.map((b) => ({ ...b, disponible: false }));
    const ctx: ToolContext = { ports: createMockPorts(f, { now: NOW }), now: NOW };
    const r = await agendar(ctx);
    expect(r.ok).toBe(true);
    expect(r.output).toMatchObject({ estado: "sin_disponibilidad", booking: null, alternativas: [] });
  });

  it("stock 0 → sin_stock + 3 alternativas valle posteriores a la reposición", async () => {
    const r = await agendar(mkCtx(), { vehicleId: "v_duster", quoteId: "q_v_duster_20000__0" });
    const out = r.output as { estado: string; booking: unknown; alternativas: { inicio: string; franja: string }[] };
    expect(out.estado).toBe("sin_stock");
    expect(out.booking).toBeNull();
    expect(out.alternativas.map((s) => s.inicio.slice(0, 10))).toEqual(["2026-11-23", "2026-11-24", "2026-11-25"]);
    expect(out.alternativas.every((s) => s.franja === "valle")).toBe(true);
  });

  it("quoteId inválido o con descuento fuera de política → ok:false", async () => {
    const a = await agendar(mkCtx(), { quoteId: "xxx" });
    expect(a.error).toBe("quote_id_invalido");
    const b = await agendar(mkCtx(), { quoteId: "q_v_cx30_10000__0.5" });
    expect(b.error).toBe("descuento_fuera_de_politica");
    expect(b.trace.at(-1)?.status).toBe("blocked");
  });
});

describe("cotizar_aliados_seguros", () => {
  it("calcula días al SOAT desde ctx.now y lista ofertas", async () => {
    const r = await executeTool("cotizar_aliados_seguros", { vehicleId: "v_cx30" }, mkCtx());
    const out = r.output as { diasParaVencimientoSoat: number; ofertas: unknown[]; vencimientoPoliza: string | null };
    expect(out.diasParaVencimientoSoat).toBe(19);
    expect(out.ofertas).toHaveLength(2);
    expect(out.vencimientoPoliza).toBeNull();
    expect(r.trace[1]).toMatchObject({ system: "Aseguradoras", autonomy: "recomendar", latencyMs: 350 });
  });
});

describe("escalar_asesor_humano", () => {
  it("crea caso abierto con contexto sin PII y sugerencia según motivo", async () => {
    const ctx = mkCtx();
    const r = await executeTool(
      "escalar_asesor_humano",
      { vehicleId: "v_cx30", motivo: "sintoma_critico", prioridad: "alta", resumen: "Humo y olor a quemado", sintomas: ["humo"], ultimoMensaje: "sale humo" },
      ctx,
    );
    expect(r.ok).toBe(true);
    const caso = (r.output as { caso: { estado: string; contexto: Record<string, unknown>; siguientePasoSugerido: string; creadoEn: string } }).caso;
    expect(caso.estado).toBe("abierto");
    expect(caso.contexto).toMatchObject({ clienteAlias: "Laura G.", vehiculo: "Mazda CX-30 2023", kmEstimado: 9550, sintomas: ["humo"] });
    expect(caso.siguientePasoSugerido.length).toBeGreaterThan(5);
    expect(Number.isNaN(Date.parse(caso.creadoEn))).toBe(false);
    expect(r.trace[1]).toMatchObject({ system: "CRM", autonomy: "ejecutar", status: "escalated" });
    expect(new Set(r.trace.map((t) => t.id)).size).toBe(r.trace.length);
  });
});
