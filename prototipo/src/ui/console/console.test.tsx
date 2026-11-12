// @vitest-environment jsdom
// T19 · Consola del asesor: página real + route handler real (sin red), como el humo.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import Home from "@/app/page";
import type { AgentTurn, TraceEvent } from "@/core/contracts";
import { resumirActividad } from "./activity";
import { modoLabel } from "./header";
import { ESTADO_CLIENTE_LABEL, estadoCliente } from "./status";

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  // Motor de reglas fijo: no depende de si la terminal tiene GEMINI_API_KEY.
  vi.stubEnv("GEMINI_API_KEY", "");
  // Solo la API del agente; cualquier otra llamada (p. ej. a Gemini desde el core) falla como sin red.
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    (typeof input === "string" ? input : input instanceof URL ? input.href : input.url) === "/api/agent"
      ? POST(new Request("http://localhost/api/agent", init))
      : Promise.reject(new Error("sin red en los tests")),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
  expect(screen.getByTestId("mode-badge").textContent).toBe("Motor: reglas");
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

test("E · en xl la app ocupa el alto visible y cada columna tiene su propio scroll", () => {
  // jsdom no mide layout: se fijan las clases que lo garantizan; la verificación visual se hace en Chrome.
  render(<Home />);
  const tiene = (el: Element, ...cls: string[]) => cls.forEach((c) => expect(el.classList.contains(c), `${c} en ${el.tagName}`).toBe(true));
  const main = screen.getByRole("main");
  tiene(main, "min-h-dvh", "xl:h-dvh", "xl:overflow-hidden");
  expect(main.classList.contains("min-h-screen")).toBe(false);
  const grid = screen.getByTestId("console-grid");
  tiene(grid, "min-h-0", "flex-1", "xl:grid-rows-[minmax(0,1fr)]");
  const columnas = [
    screen.getByRole("navigation", { name: "Clientes de hoy" }),
    document.getElementById("conversacion")!,
    screen.getByRole("region", { name: "Panel del asesor" }),
  ];
  for (const col of columnas) tiene(col, "xl:min-h-0", "xl:overflow-y-auto");
});

test("Reiniciar limpia los estados de los clientes", async () => {
  render(<Home />);
  await elige("feliz");
  expect(status("feliz")).toBe("Conversando");
  fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));
  expect(status("feliz")).toBe("Pendiente");
  expect(pasoActual()).toContain("Elija un cliente");
});

describe("G · pestañas «Conversación» | «Agenda del taller»", () => {
  const pestana = (nombre: RegExp) => screen.getByRole("tab", { name: nombre });
  const agenda = () => screen.getByRole("tabpanel", { name: /Agenda del taller/ });

  test("las reservas de la demo aparecen en la agenda, con contador, y sobreviven al cambio de cliente", async () => {
    render(<Home />);
    expect(screen.getByRole("tablist", { name: "Vista central" })).toBeTruthy();
    expect(pestana(/Conversación/).getAttribute("aria-selected")).toBe("true");
    expect(pestana(/Agenda del taller/).textContent).toContain("0");
    await elige("feliz");
    fireEvent.click((await within(screen.getByTestId("owner-chat")).findAllByRole("button", { name: "Agendar" })).at(-1)!);
    await idle();
    await waitFor(() => expect(pestana(/Agenda del taller/).textContent).toContain("1"));

    fireEvent.click(pestana(/Agenda del taller/));
    expect(pestana(/Agenda del taller/).getAttribute("aria-selected")).toBe("true");
    const cita = within(agenda()).getByTestId("agenda-cita");
    expect(cita.textContent).toContain("Mariana S.");
    expect(cita.textContent).toContain("Reservada");
    // la conversación sigue montada (oculta), sin perder lo escrito
    expect(screen.getByTestId("owner-chat").closest('[role="tabpanel"]')!.hasAttribute("hidden")).toBe(true);

    fireEvent.click(pestana(/Conversación/));
    fireEvent.click((await within(screen.getByTestId("owner-chat")).findAllByRole("button", { name: "Confirmar reserva" })).at(-1)!);
    await idle();
    fireEvent.click(pestana(/Agenda del taller/));
    await waitFor(() => expect(within(agenda()).getByTestId("agenda-cita").textContent).toContain("Confirmada"));
    fireEvent.click(pestana(/Conversación/));

    await elige("sintoma_critico");
    expect(pestana(/Agenda del taller/).textContent).toContain("1");
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));
    expect(pestana(/Agenda del taller/).textContent).toContain("0");
  });

  test("las flechas del teclado cambian de pestaña", () => {
    render(<Home />);
    fireEvent.keyDown(pestana(/Conversación/), { key: "ArrowRight" });
    expect(pestana(/Agenda del taller/).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(pestana(/Agenda del taller/));
    fireEvent.keyDown(pestana(/Agenda del taller/), { key: "ArrowLeft" });
    expect(pestana(/Conversación/).getAttribute("aria-selected")).toBe("true");
  });
});

describe("F2 · Demo guiada y Modo libre", () => {
  const modo = (nombre: string) => screen.getByRole("button", { name: nombre });
  const guion = () => screen.queryByRole("button", { name: /Siguiente mensaje del cliente/ });

  test("por defecto «Demo guiada»: pasos y botón del guion con su contador", async () => {
    render(<Home />);
    expect(screen.getByRole("group", { name: "Modo de la demo" })).toBeTruthy();
    expect(modo("Demo guiada").getAttribute("aria-pressed")).toBe("true");
    expect(modo("Modo libre").getAttribute("aria-pressed")).toBe("false");
    await elige("feliz");
    expect(guion()?.textContent).toContain("0/3");
    expect(screen.getByText("Simula lo que escribe el cliente")).toBeTruthy();
    expect(pasoActual()).toContain("Vea la conversación");
  });

  test("«Modo libre» oculta guion, ayuda y pasos, sin borrar la conversación; se puede volver", async () => {
    render(<Home />);
    await elige("feliz");
    const tarjetas = within(screen.getByTestId("owner-chat")).getAllByTestId("card-cotizacion").length;
    fireEvent.click(modo("Modo libre"));
    expect(modo("Modo libre").getAttribute("aria-pressed")).toBe("true");
    expect(guion()).toBeNull();
    expect(screen.queryByText("Simula lo que escribe el cliente")).toBeNull();
    expect(screen.queryByRole("list", { name: "Pasos para usar la consola" })).toBeNull();
    // se mantiene todo lo demás
    expect(within(screen.getByTestId("owner-chat")).getAllByTestId("card-cotizacion")).toHaveLength(tarjetas);
    expect(screen.getByLabelText("Escriba su mensaje")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Clientes de hoy" })).toBeTruthy();
    expect(screen.getByTestId("agent-activity")).toBeTruthy();
    expect(screen.getByTestId("advisor-inbox")).toBeTruthy();
    expect(window.localStorage.getItem("postventa.modoDemo")).toBe("libre");
    fireEvent.click(modo("Demo guiada"));
    expect(guion()?.textContent).toContain("0/3");
  });

  test("recuerda la elección del visitante", async () => {
    window.localStorage.setItem("postventa.modoDemo", "libre");
    render(<Home />);
    await waitFor(() => expect(modo("Modo libre").getAttribute("aria-pressed")).toBe("true"));
    expect(guion()).toBeNull();
  });

  test("funciona sin localStorage", async () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    try {
      render(<Home />);
      expect(modo("Demo guiada").getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(modo("Modo libre"));
      expect(modo("Modo libre").getAttribute("aria-pressed")).toBe("true");
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});

describe("funciones puras", () => {
  test("F1 · etiqueta del motor: reglas, IA o en espera", () => {
    expect(modoLabel("deterministic")).toBe("Motor: reglas");
    expect(modoLabel("llm")).toBe("IA Gemini activa");
    expect(modoLabel(null)).toBe("En espera");
  });

  test("estadoCliente cubre todos los estados", () => {
    expect(estadoCliente(undefined)).toBe("pendiente");
    expect(estadoCliente({ state: "TRIGGER", sinPermisoWhatsapp: true })).toBe("sin_permiso");
    expect(estadoCliente({ state: "COTIZACION", sinPermisoWhatsapp: true })).toBe("conversando");
    expect(estadoCliente({ state: "CONFIRMACION", sinPermisoWhatsapp: false })).toBe("cita_apartada");
    expect(estadoCliente({ state: "CERRADO", sinPermisoWhatsapp: false })).toBe("cita_confirmada");
    expect(estadoCliente({ state: "HANDOFF", sinPermisoWhatsapp: false })).toBe("necesita_asesor");
    expect(estadoCliente({ state: "BLOQUEADO", sinPermisoWhatsapp: false })).toBe("bloqueado");
  });

  test("T22 · seguro elegido: etiqueta propia, sin pasar por «¡Necesita asesor!»; la cita y el handoff mandan", () => {
    expect(estadoCliente({ state: "COTIZACION", sinPermisoWhatsapp: false, seguroElegido: true })).toBe("seguro_elegido");
    expect(ESTADO_CLIENTE_LABEL.seguro_elegido).toBe("Seguro elegido · asesor contactará");
    expect(estadoCliente({ state: "CONFIRMACION", sinPermisoWhatsapp: false, seguroElegido: true })).toBe("cita_apartada");
    expect(estadoCliente({ state: "CERRADO", sinPermisoWhatsapp: false, seguroElegido: true })).toBe("cita_confirmada");
    expect(estadoCliente({ state: "HANDOFF", sinPermisoWhatsapp: false, seguroElegido: true })).toBe("necesita_asesor");
  });

  test("T22 · «Qué hizo el agente»: el caso de seguro se cuenta como venta pasada a un asesor certificado", () => {
    const ev = (id: string, o: Partial<TraceEvent>): TraceEvent => ({
      id, ts: "2026-11-11T10:00:00.000Z", kind: "handoff", agent: "Copiloto", name: "handoff_asesor",
      system: "CRM", payload: { motivo: "seguro" }, latencyMs: 1, status: "escalated", ...o,
    });
    const turn = { state: "COTIZACION", mode: "deterministic", trace: [
      ev("a", { kind: "tool_result", name: "escalar_asesor_humano" }),
      ev("b", {}),
    ] } as unknown as AgentTurn;
    expect(resumirActividad([turn]).map((i) => [i.texto, i.resultado])).toEqual([
      ["Pasó la venta del seguro a un asesor certificado", "listo"],
    ]);
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
