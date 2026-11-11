// @vitest-environment jsdom
// T20 · G: «Agenda del taller» = cupos de bays.json + reservas hechas en la demo.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { Booking } from "@/core/contracts";
import bays from "@/core/data/bays.json";
import type { DemoBooking } from "@/ui/contracts";
import { WorkshopAgenda } from "./index";

afterEach(cleanup);

const dias = [...new Set(bays.map((s) => s.inicio.slice(0, 10)))].sort();
const delDia = (dia: string) => bays.filter((s) => s.inicio.startsWith(dia));
const libre = bays.find((s) => s.disponible && s.inicio.startsWith(dias[1]))!;

const reserva = (over: Partial<Booking> = {}): Booking => ({
  id: "BK-0001",
  vehicleId: "veh-01",
  slotId: libre.id,
  inicio: libre.inicio,
  bahia: libre.bahia,
  quoteId: "q_veh-01_30000__0",
  repuestosApartados: [],
  idempotencyKey: "idem-12345678",
  holdHasta: "2026-11-12T10:00",
  estado: "reservada",
  ...over,
});

const celdas = (texto: string) => within(screen.getByRole("table")).queryAllByText(texto, { exact: true }).length;

test("sin citas: un botón por día y el primer día con «Libre»/«Ocupado» según los cupos del taller", () => {
  render(<WorkshopAgenda bookings={[]} />);
  const selector = screen.getByRole("group", { name: "Día de la agenda" });
  expect(within(selector).getAllByRole("button")).toHaveLength(dias.length);
  expect(within(selector).getAllByRole("button")[0].getAttribute("aria-pressed")).toBe("true");
  const tabla = screen.getByRole("table");
  expect(tabla.querySelector("caption")!.textContent).toContain("jueves, 12 de noviembre");
  for (const b of [1, 2, 3, 4]) expect(within(tabla).getByRole("columnheader", { name: `Bahía ${b}` })).toBeTruthy();
  expect(within(tabla).getByRole("rowheader", { name: /7:00 a\. m\./ })).toBeTruthy();
  expect(celdas("Libre")).toBe(delDia(dias[0]).filter((s) => s.disponible).length);
  expect(celdas("Ocupado")).toBe(delDia(dias[0]).filter((s) => !s.disponible).length);
  expect(screen.queryByTestId("agenda-cita")).toBeNull();
});

test("una cita de la demo se resalta con cliente, vehículo, referencia y estado, y abre su día", () => {
  const citas: DemoBooking[] = [{ scenarioId: "feliz", booking: reserva() }];
  render(<WorkshopAgenda bookings={citas} />);
  const cita = screen.getByTestId("agenda-cita");
  for (const t of ["Mariana S.", "Mazda CX-30 2023", "BK-0001", "Reservada"]) expect(cita.textContent).toContain(t);
  expect(screen.getByRole("table").querySelector("caption")!.textContent).toContain("viernes, 13 de noviembre");
  expect(celdas("Libre")).toBe(delDia(dias[1]).filter((s) => s.disponible).length - 1);
  const dia = within(screen.getByRole("group", { name: "Día de la agenda" })).getByRole("button", { pressed: true });
  expect(dia.textContent).toContain("1 cita");
});

test("una cita confirmada dice «Confirmada»", () => {
  render(<WorkshopAgenda bookings={[{ scenarioId: "sin_stock", booking: reserva({ estado: "confirmada" }) }]} />);
  const cita = screen.getByTestId("agenda-cita");
  expect(cita.textContent).toContain("Confirmada");
  expect(cita.textContent).toContain("Camila A.");
});

test("elegir otro día cambia la tabla", () => {
  render(<WorkshopAgenda bookings={[]} />);
  const botones = within(screen.getByRole("group", { name: "Día de la agenda" })).getAllByRole("button");
  fireEvent.click(botones[2]);
  expect(botones[2].getAttribute("aria-pressed")).toBe("true");
  expect(botones[0].getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("table").querySelector("caption")!.textContent).toContain("sábado, 14 de noviembre");
  expect(celdas("Ocupado")).toBe(delDia(dias[2]).filter((s) => !s.disponible).length);
});
