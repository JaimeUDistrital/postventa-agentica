// @vitest-environment jsdom
// T22: toma de caso por el asesor (página real + route handler real, sin red).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "@/app/api/agent/route";
import Home from "@/app/page";

const bodies: Record<string, unknown>[] = [];
const urlDe = (i: RequestInfo | URL) => (typeof i === "string" ? i : i instanceof URL ? i.href : i.url);

beforeEach(() => {
  bodies.length = 0;
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
  // Motor de reglas fijo: no depende de si la terminal tiene GEMINI_API_KEY.
  vi.stubEnv("GEMINI_API_KEY", "");
  // Solo la API del agente; cualquier otra llamada (p. ej. a Gemini desde el core) falla como sin red.
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    if (urlDe(input) !== "/api/agent") return Promise.reject(new Error("sin red en los tests"));
    bodies.push(JSON.parse(String(init?.body)));
    return POST(new Request("http://localhost/api/agent", init));
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const chat = () => screen.getByTestId("owner-chat");
const inbox = () => screen.getByTestId("advisor-inbox");
const idle = () => waitFor(() => expect(screen.queryByTestId("typing")).toBeNull());
const escribe = (texto: string) => {
  fireEvent.change(screen.getByLabelText("Escriba su mensaje"), { target: { value: texto } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
};

async function elige(id: string) {
  fireEvent.click(screen.getByTestId(`scenario-btn-${id}`));
  await screen.findAllByTestId("trace-event");
  await idle();
}

async function casoCritico() {
  render(<Home />);
  await elige("sintoma_critico");
  fireEvent.click(screen.getByTestId("script-next"));
  await within(inbox()).findAllByTestId("handoff-card");
  await idle();
}

test("1 · «Tomar caso»: nota con el asesor y la hora; la IA queda en pausa y no se llama a la API", async () => {
  await casoCritico();
  fireEvent.click(within(inbox()).getByRole("button", { name: "Tomar caso" }));
  expect(within(inbox()).getByText("Caso tomado por usted")).toBeTruthy();
  const toma = within(chat()).getAllByRole("note").at(-1)!;
  expect(toma.textContent).toMatch(/Carlos R\. \(asesor\) tomó el caso · \d{2}:\d{2}/);
  expect(toma.textContent).toContain("Nota interna");
  expect(within(chat()).getByText("Le atiende Carlos R. (asesor)")).toBeTruthy();

  const llamadas = bodies.length;
  escribe("¿Ya viene alguien?");
  expect(within(chat()).getByText("¿Ya viene alguien?")).toBeTruthy();
  expect(within(chat()).getAllByText("La IA está en pausa: le atiende un asesor")).toHaveLength(1);
  escribe("Gracias");
  expect(within(chat()).getByText("Gracias")).toBeTruthy();
  // la nota de pausa no se repite tras cada mensaje
  expect(within(chat()).getAllByText("La IA está en pausa: le atiende un asesor")).toHaveLength(1);
  await new Promise((r) => setTimeout(r, 30));
  expect(bodies.length).toBe(llamadas);
  expect(screen.queryByTestId("typing")).toBeNull();
});

test("2 · el asesor responde y registra una llamada desde el caso tomado", async () => {
  await casoCritico();
  fireEvent.click(within(inbox()).getByRole("button", { name: "Tomar caso" }));
  const llamadas = bodies.length;

  const caja = within(inbox()).getByLabelText("Responder como asesor") as HTMLTextAreaElement;
  expect(caja.maxLength).toBe(1000);
  fireEvent.change(caja, { target: { value: "Hola Andrés, soy Carlos. Le llamo en 5 minutos." } });
  fireEvent.click(within(inbox()).getByRole("button", { name: "Enviar respuesta" }));
  const msg = within(chat()).getByTestId("mensaje-asesor");
  expect(msg.textContent).toContain("Asesor · Carlos R.");
  expect(msg.textContent).toContain("Hola Andrés, soy Carlos. Le llamo en 5 minutos.");
  expect(caja.value).toBe("");

  fireEvent.click(within(inbox()).getByRole("radio", { name: "No contestó" }));
  fireEvent.change(within(inbox()).getByLabelText("Nota de la llamada"), { target: { value: "Buzón de voz" } });
  fireEvent.click(within(inbox()).getByRole("button", { name: "Registrar llamada" }));
  expect(within(chat()).getByTestId("evento-llamada").textContent).toContain("Llamada del asesor · No contestó · Buzón de voz");

  expect(bodies.length).toBe(llamadas);
});

test("1 · si el caso es de otro cliente, la nota y la pausa van a la conversación de ese cliente", async () => {
  await casoCritico();
  await elige("feliz");
  fireEvent.click(within(inbox()).getByRole("button", { name: "Tomar caso" }));
  expect(within(chat()).queryByText(/tomó el caso/)).toBeNull();
  expect(within(chat()).queryByText(/Le atiende/)).toBeNull();
  // vuelve al cliente del caso: conversación intacta, nota de toma y IA en pausa
  fireEvent.click(screen.getByTestId("scenario-btn-sintoma_critico"));
  expect(within(chat()).getByText(/Carlos R\. \(asesor\) tomó el caso/)).toBeTruthy();
  expect(within(chat()).getByText("Le atiende Carlos R. (asesor)")).toBeTruthy();
  expect(within(chat()).getAllByTestId("card-handoff").length).toBeGreaterThan(0);
});

test("5 · cada cliente conserva su conversación al cambiar de cliente y «Reiniciar» lo borra todo", async () => {
  render(<Home />);
  await elige("feliz");
  expect(within(chat()).getAllByTestId("card-cotizacion")).toHaveLength(1);
  await elige("adversarial");
  fireEvent.click(screen.getByTestId("scenario-btn-feliz"));
  await idle();
  expect(within(chat()).getAllByTestId("card-cotizacion")).toHaveLength(1);
  expect(bodies.filter((b) => b.scenarioId === "feliz" && b.tipo === "inicio")).toHaveLength(1);

  fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));
  expect(within(chat()).queryAllByTestId("card-cotizacion")).toHaveLength(0);
  await elige("feliz");
  expect(bodies.filter((b) => b.scenarioId === "feliz" && b.tipo === "inicio")).toHaveLength(2);
});

test("4b · elegir un seguro envía un mensaje normal, abre un caso «seguro» y no bloquea la conversación", async () => {
  render(<Home />);
  await elige("feliz");
  fireEvent.click(within(chat()).getByRole("button", { name: "Ver seguros" }));
  await idle();
  const card = await within(chat()).findByTestId("card-seguro");
  // ya hay tarjeta de seguros: la cotización no vuelve a ofrecer «Ver seguros»
  expect(within(chat()).queryByRole("button", { name: "Ver seguros" })).toBeNull();
  const elegir = within(card).getAllByRole("button", { name: "Elegir este seguro" });
  fireEvent.click(elegir[0]);
  const ultimo = bodies.at(-1)!;
  expect(ultimo.tipo).toBe("mensaje");
  expect(String(ultimo.message)).toMatch(/^Quiero la opción 1: .+ · .+$/);
  expect("accion" in ultimo).toBe(false);
  await idle();
  expect(within(chat()).getByText(String(ultimo.message))).toBeTruthy();
  for (const b of within(card).getAllByRole("button", { name: "Elegir este seguro" })) expect((b as HTMLButtonElement).disabled).toBe(true);
  await within(inbox()).findByText("Quiere contratar un seguro");
  await waitFor(() =>
    expect(within(screen.getByTestId("scenario-btn-feliz")).getByTestId("client-status").textContent).toBe("Seguro elegido · asesor contactará"),
  );
  const actividad = screen.getByTestId("agent-activity");
  expect(within(actividad).getByText("Pasó la venta del seguro a un asesor certificado")).toBeTruthy();
  expect(within(actividad).queryByText("Le pasó el caso a un asesor")).toBeNull();
  // la conversación sigue: el cliente puede agendar
  expect((within(chat()).getByRole("button", { name: "Agendar" }) as HTMLButtonElement).disabled).toBe(false);
});

test("4 · Auditoría del caso crítico: la IA con su motor y herramientas; el asesor marcado como humano", async () => {
  await casoCritico();
  fireEvent.click(within(inbox()).getByRole("button", { name: "Tomar caso" }));
  fireEvent.change(within(inbox()).getByLabelText("Responder como asesor"), { target: { value: "Soy Carlos, ya le llamo" } });
  fireEvent.click(within(inbox()).getByRole("button", { name: "Enviar respuesta" }));
  fireEvent.click(screen.getByRole("tab", { name: /Auditoría/ }));
  const entradas = within(screen.getByRole("tabpanel", { name: /Auditoría/ })).getAllByTestId("auditoria-entrada");
  const autores = entradas.map((e) => e.getAttribute("data-autor"));
  expect(autores[0]).toBe("IA");
  expect(autores).toContain("Cliente");
  expect(autores.slice(-2)).toEqual(["Sistema", "Asesor"]);
  expect(entradas[0].textContent).toContain("Reglas");
  expect(entradas[0].textContent).toContain("consultar_contexto_vehiculo");
  expect(entradas.at(-1)!.textContent).toContain("humano · Carlos R.");
  expect(entradas.at(-1)!.textContent).toContain("Soy Carlos, ya le llamo");
});

test("0 · con el motor de reglas, el aviso aparece en la columna de la conversación (fuera del teléfono)", async () => {
  render(<Home />);
  expect(screen.queryByTestId("aviso-motor")).toBeNull();
  await elige("feliz");
  const aviso = screen.getByTestId("aviso-motor");
  expect(aviso.textContent).toContain("Motor de reglas (respaldo)");
  expect(chat().contains(aviso)).toBe(false);
  expect(screen.getByRole("tabpanel", { name: /Conversación/ }).contains(aviso)).toBe(true);
});
