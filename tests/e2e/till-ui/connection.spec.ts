import { expect, test, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe } from "../../support/e2e";
import { connectionScenario } from "../../support/till/connection/scenario";

const viewports = [
  { name: "till", width: 1366, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const states = [
  "disconnected",
  "connecting",
  "connected-empty",
  "queued",
  "upstream-offline",
  "blocked",
  "revoked",
  "incompatible",
] as const;

for (const state of states) {
  test(`Register connection shows the ${state} state accessibly at every target size`, async ({
    page,
  }, testInfo) => {
    const scenario = await connectionScenario.start(state, appOrigin(testInfo));
    try {
      await page.setViewportSize(viewports[0]);
      await page.goto(scenario.url);
      await expect(page.getByRole("heading", { name: "Register connection" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Host connection" })).toContainText(
        scenario.hostStatus,
      );
      await expect(page.getByRole("region", { name: "Server connection" })).toContainText(
        scenario.serverStatus,
      );
      const identity = page.getByRole("region", { name: "Register and store identity" });
      if (state === "connecting")
        await expect(page.getByRole("status", { name: "Loading register identity" })).toBeVisible();
      else await expect(identity.getByText(scenario.shopName)).toBeVisible();
      if (state === "disconnected") {
        await expect(page.getByRole("region", { name: "Host connection" })).toContainText(
          "Connected",
        );
        await scenario.disconnect();
        await expect(page.getByRole("region", { name: "Host connection" })).toContainText(
          "Disconnected",
        );
      }
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await expect(page.getByRole("heading", { name: "Register connection" })).toBeVisible();
        await expectNoSeriousAxe(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
        await page.screenshot({
          path: testInfo.outputPath(`${state}-${viewport.name}.png`),
          fullPage: true,
        });
      }
      if (state === "connecting") {
        scenario.releaseConnection();
        await scenario.waitForHandshake();
        await expect(identity.getByText(scenario.shopName)).toBeVisible();
      }
      if (state === "incompatible") expect(scenario.pushRequestCount()).toBe(0);
    } finally {
      await scenario.stop();
    }
  });
}

test("the cashier reconnects and retries with the keyboard, then opens About", async ({
  page,
}, testInfo) => {
  const scenario = await connectionScenario.start("upstream-offline", appOrigin(testInfo));
  try {
    await page.goto(scenario.url);
    const connectButton = page.getByRole("button", { name: /Reconnect|Connect/ });
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
    await expect(connectButton).toBeEnabled();
    const connections = scenario.bridgeConnectionCount();
    await page.keyboard.press("c");
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
    await expect.poll(() => scenario.bridgeConnectionCount()).toBeGreaterThan(connections);

    const pushes = scenario.pushRequestCount();
    scenario.restoreUpstream();
    await page.keyboard.press("r");
    await expect.poll(() => scenario.pushRequestCount()).toBeGreaterThan(pushes);
    await scenario.waitForPushSuccess(pushes + 1);

    await page.keyboard.press("a");
    const about = page.getByRole("dialog", { name: "About Shopper" });
    await expect(about).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(about).toBeHidden();
    await expect(page.getByRole("button", { name: "About" })).toBeFocused();
    await expectNoSeriousAxe(page);
  } finally {
    await scenario.stop();
  }
});

test("reconnecting does not show stale server status while a queued sale remains visible", async ({
  page,
}, testInfo) => {
  const scenario = await connectionScenario.start("queued", appOrigin(testInfo));
  const server = page.getByRole("region", { name: "Server connection" });
  const identity = page.getByRole("region", { name: "Register and store identity" });
  try {
    await page.goto(scenario.url);
    await expect(server).toContainText("Connected");
    await expect(server.getByText("1", { exact: true })).toBeVisible();
    await expect(identity.getByText(scenario.shopName)).toBeVisible();

    const hold = scenario.holdNextBridgeConnection();
    const connections = scenario.bridgeConnectionCount();
    await page.keyboard.press("c");
    await hold.entered;
    await expect.poll(() => scenario.bridgeConnectionCount()).toBeGreaterThan(connections);
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connecting");
    await expect(server).toContainText("Connecting");
    await expect(identity.getByText(scenario.shopName)).toBeVisible();
    await expect(server.getByText("1", { exact: true })).toBeVisible();

    hold.release();
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
    await expect(server).toContainText("Connected");
  } finally {
    await scenario.stop();
  }
});

test("browser bridge credentials leave the URL immediately and never enter browser storage", async ({
  page,
}, testInfo) => {
  const scenario = await connectionScenario.start("connected-empty", appOrigin(testInfo));
  try {
    await page.goto(scenario.url);
    await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
    expect(new URL(page.url()).hash).toBe("");
    const browserState = await page.evaluate(() =>
      [localStorage, sessionStorage]
        .flatMap((storage) => Object.keys(storage).map((key) => storage.getItem(key)))
        .join("\n"),
    );
    const browserText = await page.locator("body").innerText();
    const browserUrl = page.url();
    expect(browserState).not.toContain(scenario.capability);
    expect(browserState).not.toContain(scenario.deviceToken);
    expect(browserState).not.toContain(scenario.sessionProof);
    expect(browserText).not.toContain(scenario.deviceToken);
    expect(browserText).not.toContain(scenario.sessionProof);
    expect(browserUrl).not.toContain(scenario.deviceToken);
    expect(browserUrl).not.toContain(scenario.sessionProof);
  } finally {
    await scenario.stop();
  }
});

const malformedStatuses = [
  { name: "infinite timestamp", fault: "infinite-timestamp" },
  { name: "timestamp beyond JavaScript date range", fault: "unsafe-timestamp" },
  { name: "infinite protocol version", fault: "infinite-protocol" },
  { name: "empty application version", fault: "empty-app-version" },
] as const;

for (const malformed of malformedStatuses) {
  test(`the UI rejects a host status with ${malformed.name} without crashing`, async ({
    page,
  }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const scenario = await connectionScenario.start(
      "connected-empty",
      appOrigin(testInfo),
      malformed.fault,
    );
    try {
      await page.goto(scenario.url);
      await expect(page.getByRole("region", { name: "Host connection" })).toContainText(
        "Disconnected",
      );
      await expect(page.getByRole("alert")).toContainText("invalid response");
      expect(pageErrors).toEqual([]);
    } finally {
      await scenario.stop();
    }
  });
}

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string")
    throw new Error("Playwright baseURL is required for the register host origin");
  return new URL(baseURL).origin;
}
