// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  expect(screen.getByText(/Nada pendiente: el agente lo está resolviendo/)).toBeTruthy();
});

test("Tomar caso llama a onTake con el id", () => {
  const onTake = vi.fn();
  render(<AdvisorInbox cases={[mk("c1", "abierto")]} onTake={onTake} />);
  expect(screen.getByText(/Prioridad alta/)).toBeTruthy();
  expect(screen.getByText("Riesgo de seguridad en el vehículo")).toBeTruthy();
  expect(screen.getByText("Llamar al cliente")).toBeTruthy();
  expect(screen.getByText(/Cliente A · Mazda 3 2022/)).toBeTruthy();
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
  expect(screen.getByText("Caso tomado por usted")).toBeTruthy();
});

test("B · ordena por prioridad (alta > media > baja) y, dentro de la misma, el más reciente primero", () => {
  const caso = (id: string, prioridad: "alta" | "media" | "baja", creadoEn: string) =>
    HandoffCase.parse({ ...mk(id, "abierto"), prioridad, creadoEn, contexto: { ...mk(id, "abierto").contexto, clienteAlias: id } });
  // Orden de llegada (el más reciente primero, como lo guarda la demo).
  const cases = [
    caso("baja-nueva", "baja", "2026-11-11T10:05:00.000Z"),
    caso("media", "media", "2026-11-11T10:04:00.000Z"),
    caso("alta-nueva", "alta", "2026-11-11T10:03:00.000Z"),
    caso("alta-vieja", "alta", "2026-11-11T10:01:00.000Z"),
  ];
  render(<AdvisorInbox cases={cases} onTake={() => {}} />);
  const orden = screen.getAllByTestId("handoff-card").map((el) => el.getAttribute("aria-label")?.split(":")[0]);
  expect(orden).toEqual(["Caso de alta-nueva", "Caso de alta-vieja", "Caso de media", "Caso de baja-nueva"]);
});

test("T22 · 2 · un caso abierto no ofrece responder ni llamar; uno tomado sí", () => {
  render(<AdvisorInbox cases={[mk("c1", "abierto")]} onTake={() => {}} onReply={() => {}} onCall={() => {}} />);
  expect(screen.queryByLabelText("Responder como asesor")).toBeNull();
  expect(screen.queryByRole("button", { name: "Registrar llamada" })).toBeNull();
});

test("T22 · 2 · «Responder como asesor» (máx. 1000) llama a onReply y limpia la caja", () => {
  const onReply = vi.fn();
  render(<AdvisorInbox cases={[mk("c1", "tomado")]} onTake={() => {}} onReply={onReply} onCall={() => {}} />);
  const caja = screen.getByLabelText("Responder como asesor") as HTMLTextAreaElement;
  expect(caja.maxLength).toBe(1000);
  fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));
  expect(onReply).not.toHaveBeenCalled();
  fireEvent.change(caja, { target: { value: "  Voy en camino  " } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar respuesta" }));
  expect(onReply).toHaveBeenCalledWith("c1", "Voy en camino");
  expect(caja.value).toBe("");
  expect(screen.getByRole("status").textContent).toContain("Respuesta enviada");
});

test("T22 · 2 · «Registrar llamada» con resultado y nota corta", () => {
  const onCall = vi.fn();
  render(<AdvisorInbox cases={[mk("c1", "tomado")]} onTake={() => {}} onReply={() => {}} onCall={onCall} />);
  const grupo = screen.getByRole("group", { name: "Resultado de la llamada" });
  const radios = within(grupo).getAllByRole("radio") as HTMLInputElement[];
  expect(radios.map((r) => r.labels?.[0]?.textContent)).toEqual(["Contestó", "No contestó", "Pidió que lo llamen luego"]);
  expect(radios[0].checked).toBe(true);
  const nota = screen.getByLabelText("Nota de la llamada") as HTMLInputElement;
  expect(nota.maxLength).toBe(200);
  fireEvent.click(screen.getByRole("radio", { name: "Pidió que lo llamen luego" }));
  fireEvent.change(nota, { target: { value: "Después de las 3 p. m." } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar llamada" }));
  expect(onCall).toHaveBeenCalledWith("c1", "llamar_luego", "Después de las 3 p. m.");
  expect(nota.value).toBe("");
  expect(screen.getByRole("status").textContent).toContain("Llamada registrada");
});
