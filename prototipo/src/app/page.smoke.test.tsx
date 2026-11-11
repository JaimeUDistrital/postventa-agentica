// @vitest-environment jsdom
// Humo de UI del Orquestador (no lo edita ningún sub-agente): monta la página real y
// conecta `fetch` al route handler real, sin navegador (el sandbox no permite Chrome).
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import Home from "@/app/page";

beforeEach(() => {
  vi.stubGlobal("fetch", (_input: RequestInfo | URL, init?: RequestInit) =>
    POST(new Request("http://localhost/api/agent", init)),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("las 3 zonas existen y un escenario produce traza y memoria", async () => {
  render(<Home />);
  expect(screen.getByTestId("owner-chat")).toBeTruthy();
  expect(screen.getByTestId("xray-console")).toBeTruthy();
  expect(screen.getByTestId("advisor-inbox")).toBeTruthy();

  fireEvent.click(screen.getByTestId("scenario-btn-feliz"));

  expect((await screen.findAllByTestId("trace-event")).length).toBeGreaterThan(0);
  expect(screen.getByTestId("memory-panel").textContent).toContain("postventa");
});
