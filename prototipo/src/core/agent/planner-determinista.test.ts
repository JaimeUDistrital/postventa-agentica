import { describe, expect, it } from "vitest";
import { ToolName, type AgentRequest, type SessionState } from "@/core/contracts";
import type { PlannerInput } from "@/core/ports";
import { encodeQuoteId } from "@/core/tools";
import { hitoTarifario, planificar } from "./planner-determinista";

describe("hitoTarifario", () => {
  it("devuelve el hito exacto hasta 60.000 km", () => {
    expect(hitoTarifario(10000)).toBe(10000);
    expect(hitoTarifario(40000)).toBe(40000);
    expect(hitoTarifario(50000)).toBe(50000);
    expect(hitoTarifario(60000)).toBe(60000);
  });

  it("por encima de 60.000 km aplica el ciclo de 4 hitos", () => {
    expect(hitoTarifario(70000)).toBe(30000);
    expect(hitoTarifario(80000)).toBe(40000);
  });
});

describe("venta cruzada (T20 · A3: sin bucles)", () => {
  const quoteId = (extras: string[]) => encodeQuoteId({ vehicleId: "veh-01", hitoKm: 30000, extras, descuentoPct: 0 });
  const entrada = (extras: string[], req: Partial<AgentRequest>, maskedMessage = ""): PlannerInput => {
    const session: SessionState = {
      sessionId: "s-1",
      scenarioId: "feliz",
      vehicleId: "veh-01",
      state: extras.length ? "VENTA_CRUZADA" : "COTIZACION",
      turnos: 2,
      intentosBloqueados: 0,
      quoteId: quoteId(extras),
      bookingId: null,
      ventaCruzada: "pendiente",
      casoAbiertoId: null,
      historial: [],
    };
    return {
      request: { sessionId: "s-1", scenarioId: "feliz", tipo: "mensaje", message: maskedMessage, ...req },
      maskedMessage,
      session,
      context: null,
      toolResults: [],
      allowedTools: [...ToolName.options],
      iteration: 0,
    };
  };

  it("si el paquete ya está en la cotización, responde sin llamar herramientas", () => {
    const step = planificar(entrada(["VC-PAS-01"], { tipo: "accion", accion: "agregar_venta_cruzada" }));
    expect(step).toEqual({
      kind: "final",
      text: "El paquete ya está incluido en su cotización. ¿Le agendo la cita?",
      nextState: "COTIZACION",
      showCards: [],
    });
  });

  it("el guion «Agrégueme la revisión de frenos» tampoco vuelve a cotizar si ya está incluido", () => {
    const step = planificar(entrada(["VC-PAS-01"], {}, "Agrégueme la revisión de frenos, por favor"));
    expect(step.kind).toBe("final");
    if (step.kind === "final") expect(step.text).toBe("El paquete ya está incluido en su cotización. ¿Le agendo la cita?");
  });

  it("si el paquete pedido no está, cotiza con él (comportamiento previo)", () => {
    const step = planificar(entrada([], { tipo: "accion", accion: "agregar_venta_cruzada" }));
    expect(step.kind).toBe("tool_calls");
    if (step.kind === "tool_calls") {
      expect(step.calls[0].tool).toBe("verificar_stock_y_precio");
      expect((step.calls[0].args as { extras: string[] }).extras).toEqual(["VC-PAS-01"]);
    }
  });

  it("otro paquete distinto se agrega aunque ya haya uno", () => {
    const step = planificar(entrada(["VC-PAS-01"], {}, "y la bateria tambien"));
    expect(step.kind).toBe("tool_calls");
    if (step.kind === "tool_calls") expect((step.calls[0].args as { extras: string[] }).extras).toEqual(["VC-PAS-01", "VC-BAT-01"]);
  });
});
