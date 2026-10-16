import { expect, test, type TestInfo } from "@playwright/test";
import { startSaleScenario } from "../../../../support/till/sale/scenario";

test("a correlated fatal bridge reply clears the pending tender after reconnect", async ({
  page,
}, testInfo) => {
  const scenario = await startSaleScenario(appOrigin(testInfo));
  let injected = false;
  await page.routeWebSocket(
    (url) => new URL(url).pathname.endsWith("/bridge"),
    (route) => {
      const host = route.connectToServer();
      route.onMessage((raw) => {
        const request = JSON.parse(String(raw)) as {
          type: string;
          approvalCode?: string;
        };
        if (request.type === "tender.add" && !injected) {
          injected = true;
          host.send(JSON.stringify({ ...request, approvalCode: "AB-123" }));
        } else host.send(raw);
      });
      host.onMessage((message) => route.send(message));
    },
  );
  try {
    await page.goto(scenario.url);
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
    await expect(page.getByRole("button", { name: /Start selling/ })).toBeEnabled();
    await page.keyboard.press("s");
    await expect(page.getByRole("heading", { name: "Sale", exact: true })).toBeVisible();
    const scan = page.getByRole("combobox", { name: "Scan barcode or search items" });
    await scan.fill("MILO-400");
    await page.getByRole("option", { name: /Milo 400g tin/ }).click();

    await page.keyboard.press("Alt+3");
    const dialog = page.getByRole("dialog", { name: "Card payment" });
    await dialog.getByRole("textbox", { name: "Approval code" }).fill("ABCD");
    await dialog.getByRole("button", { name: "Add card tender" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Register host disconnected" }),
    ).toBeVisible();
    expect(injected).toBe(true);

    await page.getByRole("button", { name: "Reconnect" }).click();
    await expect(page.getByRole("button", { name: "Reconnect" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Split" })).toBeEnabled();
  } finally {
    await scenario.stop();
  }
});

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  return new URL(baseURL).origin;
}
