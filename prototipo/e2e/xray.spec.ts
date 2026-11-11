import { expect, test } from "@playwright/test";

test("escenario feliz llena la traza y la memoria en Rayos X", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("xray-console")).toContainText("Elija un escenario");
  await page.getByTestId("scenario-btn-feliz").click();
  await expect(page.getByTestId("trace-event").first()).toBeVisible();
  expect(await page.getByTestId("trace-event").count()).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId("memory-panel")).toBeVisible();
  await expect(page.getByTestId("memory-panel")).toContainText("postventa");
});
