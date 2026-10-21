// The shift screens against a real register host: the closed register, the float, the Z and the customer display.
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { startSaleScenario } from "../../../../support/till/sale/scenario";
import { count } from "./harness";

let scenario: Awaited<ReturnType<typeof startSaleScenario>> | undefined;
test.afterEach(async () => scenario?.stop());

async function openRegister(page: Page, testInfo: { project: { use: { baseURL?: string } } }) {
  const origin = new URL(String(testInfo.project.use.baseURL)).origin;
  scenario = await startSaleScenario(origin, ["shift.write", "shift.read", "report.read"], {
    shift: false,
  });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(scenario.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  return new URL(String(testInfo.project.use.baseURL)).origin;
}

test("a register with no shift is closed, opens with a counted float, and closes with a Z", async ({
  page,
}, testInfo) => {
  const origin = await openRegister(page, testInfo);
  const display = await page.context().newPage();
  await display.goto(`${origin}/?display${new URL(scenario!.url).hash}`);
  await expect(display.getByRole("heading", { level: 1 })).toHaveText("Register closed");

  await expect(page.getByRole("heading", { name: "Register closed", exact: true })).toBeVisible();
  await page.keyboard.press("Alt+O");
  await count(page, "200").fill("1");
  await expectNoSeriousAxe(page);
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("combobox", { name: "Scan barcode or search items" })).toBeVisible();
  await expect(display.getByRole("heading", { level: 1 })).toContainText("Welcome to");

  await page.keyboard.press("Alt+H");
  await expect(page.getByRole("region", { name: "Shift details" })).toContainText("GH₵ 200.00");
  await expect(page.getByRole("region", { name: "X report" })).toContainText("GH₵ 200.00");

  await page.keyboard.press("Alt+Z");
  await count(page, "200").fill("1");
  await page.keyboard.press("ControlOrMeta+Enter");
  await page.getByRole("textbox", { name: "Card terminal total (GH₵)" }).fill("0");
  await page.getByRole("textbox", { name: "MoMo terminal total (GH₵)" }).fill("0");
  await page.keyboard.press("ControlOrMeta+Enter");

  await expect(page.getByRole("status").filter({ hasText: "Shift closed" })).toContainText(
    "Z saved. It did not print",
  );
  const z = page.getByRole("region", { name: "Z report" });
  await expect(
    z.getByRole("table", { name: "Tenders" }).getByRole("row", { name: /^Cash/ }),
  ).toContainText("Balanced");
  await expect(z.getByRole("region", { name: "Audit anchor" })).toContainText("#");
  await expectNoSeriousAxe(page);
  await expect(display.getByRole("heading", { level: 1 })).toHaveText("Register closed");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("main", { name: "Shift" }).getByText("Open a shift to start selling"),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Last shift" })).toContainText(
    /Waiting to upload|Uploaded/,
  );
});
