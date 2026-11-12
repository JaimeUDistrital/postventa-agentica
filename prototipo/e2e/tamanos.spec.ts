import { expect, test } from "@playwright/test";

/**
 * La consola en varios monitores: área útil de la ventana (pantalla menos barras del navegador y del
 * sistema). Desde 1280 px de ancho (xl) la consola cabe en una vista y cada columna tiene su scroll;
 * por debajo, la página baja normal. En ningún caso hay scroll horizontal ni espacio en blanco al final.
 */
const TAMANOS = [
  { nombre: "Full HD", width: 1920, height: 947 },
  { nombre: "portátil 1536×864", width: 1536, height: 730 },
  { nombre: "1440×900", width: 1440, height: 789 },
  { nombre: "1366×768", width: 1366, height: 607 },
  { nombre: "1280×720", width: 1280, height: 595 },
  { nombre: "tableta horizontal", width: 1024, height: 768 },
  { nombre: "tableta vertical", width: 768, height: 1024 },
  { nombre: "celular", width: 390, height: 844 },
] as const;

for (const t of TAMANOS) {
  test(`tamaño ${t.nombre} (${t.width}×${t.height}): sin scroll horizontal ni espacio en blanco`, async ({ page }) => {
    await page.setViewportSize({ width: t.width, height: t.height });
    await page.goto("/");
    await page.getByTestId("scenario-btn-feliz").click();
    await expect(page.getByTestId("typing")).toHaveCount(0, { timeout: 15_000 });

    const m = await page.evaluate(() => {
      const se = document.scrollingElement as Element;
      const main = document.querySelector("main") as HTMLElement;
      return {
        alto: se.scrollHeight,
        ancho: se.scrollWidth,
        ventanaAlto: window.innerHeight,
        ventanaAncho: window.innerWidth,
        finContenido: Math.ceil(main.getBoundingClientRect().bottom + window.scrollY),
      };
    });
    expect(m.ancho, "sin scroll horizontal").toBeLessThanOrEqual(m.ventanaAncho);
    if (t.width >= 1280) expect(m.alto, "la consola cabe en la ventana").toBeLessThanOrEqual(m.ventanaAlto);
    else expect(m.alto, "sin espacio en blanco tras el contenido").toBeLessThanOrEqual(m.finContenido + 1);
  });
}
