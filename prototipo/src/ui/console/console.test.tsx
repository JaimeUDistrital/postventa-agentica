// @vitest-environment jsdom
// T19 · Consola del asesor: página real + route handler real (sin red), como el humo.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import Home from "@/app/page";
import type { AgentTurn, TraceEvent } from "@/core/contracts";
import { resumirActividad } from "./activity";
import { estadoCliente } from "./status";

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) =>
    POST(new Request("http://localhost/api/agent", init)),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const card = (id: string) => screen.getByTestId(`scenario-btn-${id}`);
const status = (id: string) => within(card(id)).getByTestId("client-status").textContent;
const idle = () => waitFor(() => expect(screen.queryByTestId("typing")).toBeNull());
const pasoActual = () => document.querySelector('ol[aria-label="Pasos para usar la consola"] [aria-current="step"]')?.textContent ?? "";

async function elige(id: string) {
  fireEvent.click(card(id));
  await screen.findAllByTestId("trace-event");
  await idle();
}

test("la lista muestra 5 clientes con su situación y estado Pendiente", () => {
  render(<Home />);
  const lista = screen.getByRole("navigation", { name: "Clientes de hoy" });
  expect(within(lista).getAllByRole("button")).toHaveLength(5);
  for (const t of [
    "Le toca el mantenimiento de 30.000 km",
    "Reporta olor a quemado",
    "Falta un repuesto",
    "Pide un precio irreal",
    "No autorizó WhatsApp",
  ])
    expect(within(lista).getByText(t)).toBeTruthy();
  expect(within(lista).getByText("Mariana S.")).toBeTruthy();
  expect(status("feliz")).toBe("Pendiente");
  expect(pasoActual()).toContain("Elija un cliente");
  expect(screen.getByTestId("mode-badge").textContent).toBe("En espera");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Postventa Agéntica · Consola del asesor");
});

test("feliz: «Qué hizo el agente» en frases humanas y la etiqueta del cliente cambia", async () => {
  render(<Home />);
  await elige("feliz");
  const act = screen.getByTestId("agent-activity");
  expect(within(act).getByText("Qué hizo el agente")).toBeTruthy();
  expect(within(act).getByText("Revisó el historial del vehículo")).toBeTruthy();
  expect(within(act).getByText("Revisó repuestos y precio en el tarifario")).toBeTruthy();
  // sin jerga: ni nombres de herramientas ni eventos del planner determinista
  expect(act.textContent).not.toMatch(/consultar_contexto|planner|TRIGGER|guardrail/);
  expect(within(act).getAllByText("Listo").length).toBeGreaterThan(0);
  expect(status("feliz")).toBe("Conversando");
  expect(pasoActual()).toContain("Vea la conversación");
  expect(screen.getByTestId("mode-badge").textContent).toBe("Modo guiado");
  expect(screen.getByRole("heading", { name: /WhatsApp · Mariana S\./ })).toBeTruthy();
  expect(screen.getByText("Así lo ve el cliente")).toBeTruthy();

  fireEvent.click((await within(screen.getByTestId("owner-chat")).findAllByRole("button", { name: "Agendar" })).at(-1)!);
  await idle();
  await within(act).findByText("Apartó un espacio en el taller");
  expect(status("feliz")).toBe("Cita apartada");
  fireEvent.click((await within(screen.getByTestId("owner-chat")).findAllByRole("button", { name: "Confirmar reserva" })).at(-1)!);
  await idle();
  await waitFor(() => expect(status("feliz")).toBe("Cita confirmada"));
  expect(within(act).getByText("Confirmó la cita en el taller")).toBeTruthy();
});

test("sintoma_critico: el caso llega a «Necesita su acción» y la etiqueta es «¡Necesita asesor!»", async () => {
  render(<Home />);
  const inbox = screen.getByTestId("advisor-inbox");
  expect(within(inbox).getByText("Nada pendiente: el agente lo está resolviendo.")).toBeTruthy();
  await elige("sintoma_critico");
  fireEvent.click(screen.getByRole("button", { name: /Siguiente mensaje del cliente/ }));
  await within(inbox).findAllByTestId("handoff-card");
  expect(within(inbox).getByText("Necesita su acción")).toBeTruthy();
  expect(within(inbox).getByText("Riesgo de seguridad en el vehículo")).toBeTruthy();
  expect(within(inbox).getByText(/Andrés F\. · Toyota Corolla Cross 2022/)).toBeTruthy();
  expect(within(inbox).getByText("Siguiente paso sugerido")).toBeTruthy();
  await waitFor(() => expect(status("sintoma_critico")).toBe("¡Necesita asesor!"));
  expect(pasoActual()).toContain("Atienda lo que el agente le pase");
  const act = screen.getByTestId("agent-activity");
  expect(within(act).getByText("Detectó un riesgo de seguridad")).toBeTruthy();
  expect(within(act).getByText("Le pasó el caso a un asesor")).toBeTruthy();

  // el estado del cliente se conserva al cambiar de cliente
  await elige("adversarial");
  expect(status("sintoma_critico")).toBe("¡Necesita asesor!");
  fireEvent.click(within(inbox).getByRole("button", { name: "Tomar caso" }));
  expect(within(inbox).getByText("Caso tomado por usted")).toBeTruthy();
});

test("adversarial y sin_consentimiento: bloqueo y sin permiso en palabras", async () => {
  render(<Home />);
  await elige("sin_consentimiento");
  expect(status("sin_consentimiento")).toBe("Sin permiso de contacto");
  expect(within(screen.getByTestId("agent-activity")).getByText("No le escribió al cliente: no autorizó WhatsApp")).toBeTruthy();
  await elige("adversarial");
  fireEvent.click(screen.getByRole("button", { name: /Siguiente mensaje del cliente/ }));
  await waitFor(() => expect(status("adversarial")).toBe("Bloqueado por seguridad"));
  expect(within(screen.getByTestId("agent-activity")).getByText("Bloqueó un intento de manipulación")).toBeTruthy();
});

test("el detalle técnico está plegado y contiene trace-event y memory-panel", async () => {
  render(<Home />);
  await elige("feliz");
  const summary = screen.getByText("Ver detalle técnico (para el jurado)");
  const details = summary.closest("details")!;
  expect(details.open).toBe(false);
  expect(within(details).getByTestId("xray-console")).toBeTruthy();
  expect(within(details).getAllByTestId("trace-event").length).toBeGreaterThan(0);
  expect(within(details).getByTestId("memory-panel").textContent).toContain("postventa");
});

test("«¿Cómo funciona?» abre un panel propio y se cierra con Esc", async () => {
  render(<Home />);
  const btn = screen.getByRole("button", { name: "¿Cómo funciona?" });
  expect(btn.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(btn);
  const panel = screen.getByRole("dialog", { name: "Cómo funciona" });
  expect(panel.querySelectorAll("li")).toHaveLength(4);
  expect(panel.textContent).toContain("tarifario");
  expect(btn.getAttribute("aria-expanded")).toBe("true");
  await waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("Cerrar «Cómo funciona»"));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(btn);
});

test("Reiniciar limpia los estados de los clientes", async () => {
  render(<Home />);
  await elige("feliz");
  expect(status("feliz")).toBe("Conversando");
  fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));
  expect(status("feliz")).toBe("Pendiente");
  expect(pasoActual()).toContain("Elija un cliente");
});

describe("funciones puras", () => {
  test("estadoCliente cubre todos los estados", () => {
    expect(estadoCliente(undefined)).toBe("pendiente");
    expect(estadoCliente({ state: "TRIGGER", sinPermisoWhatsapp: true })).toBe("sin_permiso");
    expect(estadoCliente({ state: "COTIZACION", sinPermisoWhatsapp: true })).toBe("conversando");
    expect(estadoCliente({ state: "CONFIRMACION", sinPermisoWhatsapp: false })).toBe("cita_apartada");
    expect(estadoCliente({ state: "CERRADO", sinPermisoWhatsapp: false })).toBe("cita_confirmada");
    expect(estadoCliente({ state: "HANDOFF", sinPermisoWhatsapp: false })).toBe("necesita_asesor");
    expect(estadoCliente({ state: "BLOQUEADO", sinPermisoWhatsapp: false })).toBe("bloqueado");
  });

  test("resumirActividad agrupa repeticiones y omite eventos irrelevantes", () => {
    const ev = (id: string, o: Partial<TraceEvent>): TraceEvent => ({
      id, ts: "2026-11-11T10:00:00.000Z", kind: "tool_result", agent: "Postventa", name: "verificar_stock_y_precio",
      system: "Inventario", payload: {}, latencyMs: 1, status: "ok", ...o,
    });
    const turn = (trace: TraceEvent[], mode: AgentTurn["mode"] = "deterministic") =>
      ({ state: "COTIZACION", mode, trace }) as unknown as AgentTurn;
    const items = resumirActividad([
      turn([ev("a", { kind: "llm", name: "planner.determinista", system: "LLM" }), ev("b", {}), ev("c", { system: "Tarifario" })]),
      turn([ev("d", {}), ev("e", { kind: "llm", name: "planner.gemini", system: "LLM" })], "llm"),
      turn([ev("f", { kind: "policy", name: "politica_x", status: "blocked", system: "Guardián" })]),
    ]);
    expect(items.map((i) => [i.texto, i.veces])).toEqual([
      ["Revisó repuestos y precio en el tarifario", 2],
      ["Consultó la IA", 1],
      ["Frenó una acción no permitida", 1],
    ]);
  });
});
