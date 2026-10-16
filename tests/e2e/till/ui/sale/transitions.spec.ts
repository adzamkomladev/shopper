import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { startSaleScenario } from "../../../../support/till/sale/scenario";

test("hold and void keep the sale locked until the open basket refresh completes", async ({
  page,
}, testInfo) => {
  const scenario = await startSaleScenario(appOrigin(testInfo), ["sale.void"]);
  const reads = await transitionReads(page);
  try {
    await page.goto(scenario.url);
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
    await expect(page.getByRole("button", { name: /Start selling/ })).toBeEnabled();
    await page.keyboard.press("s");
    const scan = page.getByRole("combobox", { name: "Scan barcode or search items" });
    await scan.fill("MILO-400");
    await page.getByRole("option", { name: /Milo 400g tin/ }).click();

    await page.getByRole("button", { name: "Hold sale" }).click();
    await reads.held;
    await expect(page.getByRole("button", { name: "Hold sale" })).toBeDisabled();
    reads.releaseHeld();
    await expect(page.getByText("Basket is empty")).toBeVisible();

    await scan.fill("PEAK-160");
    await page.getByRole("option", { name: /Peak milk 160g/ }).click();
    await expect(page.getByRole("list", { name: "Basket lines" })).toContainText("Peak milk 160g");
    await page.getByRole("button", { name: "Void sale" }).click();
    const dialog = page.getByRole("dialog", { name: "Void sale" });
    await dialog.getByRole("textbox", { name: "Reason" }).fill("Customer changed their mind");
    await dialog.getByRole("button", { name: "Void sale" }).click();
    await reads.voided;
    await expect(page.getByRole("button", { name: "Void sale" })).toBeDisabled();
    reads.releaseVoided();
    await expect(page.getByText("Basket is empty")).toBeVisible();
  } finally {
    reads.releaseHeld();
    reads.releaseVoided();
    await scenario.stop();
  }
});

test("active void stays locked until the open basket refresh completes", async ({
  page,
}, testInfo) => {
  const scenario = await startSaleScenario(appOrigin(testInfo), ["sale.void"]);
  const reads = await transitionReads(page);
  try {
    await page.goto(scenario.url);
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
    await expect(page.getByRole("button", { name: /Start selling/ })).toBeEnabled();
    await page.keyboard.press("s");
    const scan = page.getByRole("combobox", { name: "Scan barcode or search items" });
    await scan.fill("MILO-400");
    await page.getByRole("option", { name: /Milo 400g tin/ }).click();

    await page.getByRole("button", { name: "Void sale" }).click();
    const dialog = page.getByRole("dialog", { name: "Void sale" });
    await dialog.getByRole("textbox", { name: "Reason" }).fill("Customer changed their mind");
    await dialog.getByRole("button", { name: "Void sale" }).click();
    await reads.voided;
    await expect(page.getByRole("button", { name: "Void sale" })).toBeDisabled();
    reads.releaseVoided();
    await expect(page.getByText("Basket is empty")).toBeVisible();
  } finally {
    reads.releaseHeld();
    reads.releaseVoided();
    await scenario.stop();
  }
});

async function transitionReads(page: Page) {
  let heldStarted!: () => void;
  let voidStarted!: () => void;
  let releaseHeld!: () => void;
  let releaseVoided!: () => void;
  const held = new Promise<void>((resolve) => (heldStarted = resolve));
  const voided = new Promise<void>((resolve) => (voidStarted = resolve));
  const heldRelease = new Promise<void>((resolve) => (releaseHeld = resolve));
  const voidRelease = new Promise<void>((resolve) => (releaseVoided = resolve));
  await page.routeWebSocket(
    (url) => new URL(url).pathname.endsWith("/bridge"),
    (route) => {
      const host = route.connectToServer();
      let transition: "hold" | "void" | undefined;
      let delayedRead: string | undefined;
      route.onMessage((raw) => {
        const request = JSON.parse(String(raw)) as { id: string; type: string; draftId?: string };
        if (request.type === "sale.hold") transition = "hold";
        if (request.type === "sale.void" && !request.draftId) transition = "void";
        if (request.type === "readDraft" && transition) delayedRead = request.id;
        host.send(raw);
      });
      host.onMessage((raw) => {
        const reply = JSON.parse(String(raw)) as { id?: string };
        if (reply.id !== delayedRead) return route.send(raw);
        delayedRead = undefined;
        if (transition === "hold") {
          heldStarted();
          void heldRelease.then(() => route.send(raw));
        }
        if (transition === "void") {
          voidStarted();
          void voidRelease.then(() => route.send(raw));
        }
        transition = undefined;
      });
    },
  );
  return { held, voided, releaseHeld, releaseVoided };
}

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  return new URL(baseURL).origin;
}
