import { describe, expect, test } from "vitest";
import { runTurn } from "@/core/agent";
import { assumptions, policy } from "@/core/config";
import { AgentRequest, AgentTurn, TOOL_META, TOOL_SCHEMAS, ToolName } from "@/core/contracts";

describe("contratos del esqueleto (T00)", () => {
  test("runTurn devuelve un AgentTurn válido", async () => {
    const req = AgentRequest.parse({ sessionId: "s1", scenarioId: "feliz", tipo: "inicio" });
    const turn = await runTurn(req);
    expect(AgentTurn.safeParse(turn).success).toBe(true);
  });

  test("toda herramienta tiene metadatos y esquemas", () => {
    for (const t of ToolName.options) {
      expect(TOOL_META[t]).toBeDefined();
      expect(TOOL_SCHEMAS[t]).toBeDefined();
    }
  });

  test("AgentRequest rechaza mensajes de más de 1000 caracteres y escenarios desconocidos", () => {
    expect(AgentRequest.safeParse({ sessionId: "s", scenarioId: "feliz", message: "x".repeat(1001) }).success).toBe(false);
    expect(AgentRequest.safeParse({ sessionId: "s", scenarioId: "otro" }).success).toBe(false);
  });

  test("la política del agente sale de la fuente única de supuestos", () => {
    expect(assumptions.mercado).toBe("Colombia");
    expect(policy.topeDescuentoPct).toBe(0.05);
  });
});
