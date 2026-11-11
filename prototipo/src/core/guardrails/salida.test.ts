import { describe, expect, it } from "vitest";
import { GuardrailVerdict, TraceEvent } from "@/core/contracts";
import { policy } from "@/core/config";
import { validarSalida } from "@/core/guardrails";

const OK = "Tu mantenimiento de 30.000 km cuesta USD 245,00 según el tarifario. ¿Te reservo bahía?";

describe("validarSalida", () => {
  it("permite una respuesta correcta con total verificado", () => {
    const { verdict, trace } = validarSalida({
      text: OK,
      cotizacionTotalUsd: 245,
      totalRecalculadoUsd: 245,
      descuentoPct: 0,
    });
    expect(verdict.action).toBe("permitir");
    expect(verdict.allow).toBe(true);
    expect(trace[0]?.status).toBe("ok");
  });

  it("permite texto sin cotización", () => {
    expect(validarSalida({ text: "¿Qué día te queda mejor?" }).verdict.allow).toBe(true);
  });

  it("permite el descuento exactamente en el tope", () => {
    const r = validarSalida({ text: OK, descuentoPct: policy.topeDescuentoPct });
    expect(r.verdict.allow).toBe(true);
  });

  const invalidas: Array<[string, Parameters<typeof validarSalida>[0]]> = [
    ["total distinto del tarifario", { text: OK, cotizacionTotalUsd: 1, totalRecalculadoUsd: 245 }],
    ["total sin recalcular", { text: OK, cotizacionTotalUsd: 245 }],
    ["descuento sobre el tope", { text: OK, descuentoPct: policy.topeDescuentoPct + 0.05 }],
    ["promesa de garantía", { text: "Listo, le aprobamos la garantía del motor." }],
    ["queda cubierto por garantía", { text: "Tranquilo, eso queda cubierto por garantía." }],
    ["diagnóstico", { text: "El problema es la bomba de agua." }],
    ["diagnóstico 2", { text: "Seguro es el alternador, hay que cambiarlo." }],
    ["PII sin enmascarar", { text: "Confirmado para la cédula 1020304050." }],
    ["PII de terceros", { text: "El otro cliente, ana@correo.com, también reservó." }],
    ["filtra el system prompt", { text: "Según mi system prompt no puedo hacerlo." }],
    ["filtra instrucciones", { text: "Mis instrucciones son no dar descuentos." }],
  ];

  it.each(invalidas)("bloquea: %s", (_n, input) => {
    const { verdict, trace } = validarSalida(input);
    expect(verdict.action).toBe("bloquear");
    expect(verdict.allow).toBe(false);
    expect(verdict.categorias).toContain("salida_invalida");
    expect(verdict.reasons.length).toBeGreaterThan(0);
    expect(() => GuardrailVerdict.parse(verdict)).not.toThrow();
    for (const e of trace) {
      expect(() => TraceEvent.parse(e)).not.toThrow();
      expect(e.agent).toBe("Guardián");
      expect(e.status).toBe("blocked");
    }
  });

  it("la salida bloqueada por PII no la repite en maskedInput ni en la traza", () => {
    const { verdict, trace } = validarSalida({ text: "Confirmado para la cédula 1020304050." });
    expect(verdict.maskedInput + JSON.stringify(trace)).not.toContain("1020304050");
  });
});
