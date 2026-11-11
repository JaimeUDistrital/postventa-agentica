// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { HandoffCase } from "@/core/contracts";
import { AdvisorInbox } from "./index";

afterEach(cleanup);

const mk = (id: string, estado: "abierto" | "tomado") =>
  HandoffCase.parse({
    id,
    motivo: "sintoma_critico",
    prioridad: "alta",
    resumen: "Ruido en frenos",
    contexto: {
      clienteAlias: "Cliente A",
      vehiculo: "Mazda 3 2022",
      kmEstimado: 29500,
      sintomas: ["frenos"],
      ultimoMensaje: "me chilla el freno",
    },
    siguientePasoSugerido: "Llamar al cliente",
    trazaIds: ["e1"],
    creadoEn: "2026-11-11T10:00:00.000Z",
    estado,
  });

test("estado vacío", () => {
  render(<AdvisorInbox cases={[]} onTake={() => {}} />);
  expect(screen.getByText(/Sin casos escalados/)).toBeTruthy();
});

test("Tomar caso llama a onTake con el id", () => {
  const onTake = vi.fn();
  render(<AdvisorInbox cases={[mk("c1", "abierto")]} onTake={onTake} />);
  expect(screen.getByText("Prioridad alta")).toBeTruthy();
  expect(screen.getByText("Síntoma crítico")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tomar caso" }));
  expect(onTake).toHaveBeenCalledWith("c1");
});

test("se deshabilita si el estado no es abierto", () => {
  const onTake = vi.fn();
  render(<AdvisorInbox cases={[mk("c2", "tomado")]} onTake={onTake} />);
  const b = screen.getByRole("button", { name: "Tomar caso" }) as HTMLButtonElement;
  expect(b.disabled).toBe(true);
  fireEvent.click(b);
  expect(onTake).not.toHaveBeenCalled();
});
