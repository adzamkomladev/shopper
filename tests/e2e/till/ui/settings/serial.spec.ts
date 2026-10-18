// The settings screen against a real register host: a serial printer saved from the screen takes a test print over a pty.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { startSerialPair } from "../../../../support/hardware/serial";
import { startSaleScenario } from "../../../../support/till/sale/scenario";
import { devices, shoot } from "./harness";

let scenario: Awaited<ReturnType<typeof startSaleScenario>> | undefined;
let pair: Awaited<ReturnType<typeof startSerialPair>> | undefined;

test.beforeEach(async ({ page }, testInfo) => {
  scenario = await startSaleScenario(appOrigin(testInfo), ["register.settings"]);
  pair = await startSerialPair();
  await page.setViewportSize({ width: 1366, height: 768 });
});
test.afterEach(async () => {
  await pair?.stop();
  await scenario?.stop();
});

test("a serial printer is saved from the screen and Test print reaches the port", async ({
  page,
}, testInfo) => {
  await hideListedPorts(page);
  await page.goto(scenario!.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  await page.keyboard.press("Alt+T");
  await expect(devices(page)).toContainText("No printer set up");

  await devices(page)
    .getByRole("button", { name: /^Add printer/ })
    .click();
  await page.getByRole("combobox", { name: "Connection", exact: true }).click();
  await page.getByRole("option", { name: "Serial port" }).click();
  await expect(page.getByRole("button", { name: /^Refresh list/ })).toBeVisible();
  // A pty is not in any host's port list, so with none listed the field is the typed fallback.
  const port = page.getByRole("textbox", { name: "Port", exact: true });
  await expect(port).toBeVisible();
  await expect(
    page.getByText("No serial ports found. Plug the device in, then refresh."),
  ).toBeVisible();
  await port.fill(pair!.path);
  await page.keyboard.press("ControlOrMeta+S");
  await expect(page.getByText("Register settings saved")).toBeVisible();
  await expect(devices(page)).toContainText(`Serial · ${pair!.path} @ 9600`);

  await page.keyboard.press("Alt+R");
  await expect(page.getByRole("status")).toContainText("Test page sent to the printer");
  await expect(async () =>
    expect(Buffer.from(await pair!.written()).toString("latin1")).toContain("Printer test"),
  ).toPass();
  await expect(devices(page).getByText("Connected", { exact: true })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "settings-serial-live");
});

/** The test box may list real ports (a Linux container has ttyS0-31); this spec needs the host to list none. */
async function hideListedPorts(page: Page) {
  await page.routeWebSocket(
    (url) => url.pathname.endsWith("/bridge"),
    (route) => {
      const host = route.connectToServer();
      route.onMessage((message) => host.send(message));
      host.onMessage((message) => {
        const reply = JSON.parse(String(message)) as { kind?: string };
        route.send(reply.kind === "printers" ? JSON.stringify({ ...reply, serial: [] }) : message);
      });
    },
  );
}

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  return new URL(baseURL).origin;
}
