// @vitest-environment jsdom
// T22 · 0: aviso del motor de reglas (plegable y recordado por visitante).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { EngineNotice } from "./engine-notice";

// ADR 0007: la IA atiende a todos; el motor de reglas es el respaldo cuando Gemini no está disponible.
const TEXTO =
  "Motor de reglas (respaldo): la IA no está disponible en este momento. El agente responde a intenciones conocidas por palabras clave y, si no entiende, le pasa el caso a un asesor.";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

test("con el motor de reglas se ve el aviso completo como nota, sin mencionar el código", () => {
  render(<EngineNotice mode="deterministic" />);
  expect(screen.getByRole("note").textContent).toBe(TEXTO);
  expect(screen.getByRole("note").textContent).not.toMatch(/código/);
});

test("con Gemini o sin turnos no aparece", () => {
  render(<EngineNotice mode="llm" />);
  expect(screen.queryByRole("note")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  cleanup();
  render(<EngineNotice mode={null} />);
  expect(screen.queryByRole("note")).toBeNull();
});

test("se puede plegar y desplegar, y se recuerda", () => {
  render(<EngineNotice mode="deterministic" />);
  const ocultar = screen.getByRole("button", { name: "Ocultar aviso" });
  expect(ocultar.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(ocultar);
  expect(screen.queryByRole("note")).toBeNull();
  const ver = screen.getByRole("button", { name: "Ver aviso del motor de reglas" });
  expect(ver.getAttribute("aria-expanded")).toBe("false");
  expect(window.localStorage.getItem("postventa.avisoMotor")).toBe("plegado");
  cleanup();
  render(<EngineNotice mode="deterministic" />);
  expect(screen.queryByRole("note")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ver aviso del motor de reglas" }));
  expect(screen.getByRole("note").textContent).toBe(TEXTO);
  expect(window.localStorage.getItem("postventa.avisoMotor")).toBe("abierto");
});

test("funciona sin localStorage", () => {
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("bloqueado");
  });
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("bloqueado");
  });
  try {
    render(<EngineNotice mode="deterministic" />);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar aviso" }));
    expect(screen.queryByRole("note")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver aviso del motor de reglas" }));
    expect(screen.getByRole("note")).toBeTruthy();
  } finally {
    get.mockRestore();
    set.mockRestore();
  }
});
