import { expect, test, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe } from "../../support/e2e";
import { connectionScenario, type StatusScenario } from "../../support/till/connection/scenario";

const viewports = [
  { name: "till", width: 1366, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const states: { scenario: StatusScenario; label: string }[] = [
  { scenario: "live", label: "Live" },
  { scenario: "polling", label: "Polling" },
  { scenario: "offline", label: "Offline" },
  { scenario: "syncing", label: "Syncing" },
  { scenario: "upgrade", label: "Upgrade needed" },
  { scenario: "revoked", label: "Device revoked" },
];

for (const state of states) {
  test(`register sync status shows ${state.label} accessibly at every target size`, async ({
    page,
  }, testInfo) => {
    const scenario = await connectionScenario.start(state.scenario, appOrigin(testInfo));
    try {
      const initialPull = state.scenario === "live" ? await scenario.waitForPull(1) : undefined;
      if (initialPull) expect(initialPull.status).toBe(200);
      await page.goto(scenario.url);
      const status = page.getByRole("region", { name: "Sync status" });
      await expect(status).toContainText(state.label);
      const syncNow = page.getByRole("button", { name: /Sync now.*Y/ });
      await expect(syncNow).toHaveAttribute("aria-keyshortcuts", "Y");
      if (["syncing", "upgrade", "revoked"].includes(state.scenario))
        await expect(syncNow).toBeDisabled();
      if (state.scenario === "live") {
        await scenario.waitForPull(1);
        const pulls = scenario.pullRequestCount();
        await page.keyboard.press("y");
        await scenario.waitForPull(pulls + 1);
      }
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await expectNoSeriousAxe(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
        await page.screenshot({
          path: testInfo.outputPath(`${state.scenario}-${viewport.name}.png`),
          fullPage: true,
        });
      }
    } finally {
      await scenario.stop();
    }
  });
}

test("receipt status warns at 100 remaining and reports overflow after exhaustion", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const scenario = await connectionScenario.start("receipts", appOrigin(testInfo));
  try {
    await page.goto(scenario.url);
    const status = page.getByRole("region", { name: "Sync status" });
    await expect(status).toContainText("Receipts low");
    await expect(status).toContainText("99 receipts remaining");
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectNoSeriousAxe(page);
      await page.screenshot({
        path: testInfo.outputPath(`receipts-low-${viewport.name}.png`),
        fullPage: true,
      });
    }

    await scenario.recordSales(100);
    await expect(status).toContainText("Receipt overflow");
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectNoSeriousAxe(page);
      await page.screenshot({
        path: testInfo.outputPath(`receipt-overflow-${viewport.name}.png`),
        fullPage: true,
      });
    }
  } finally {
    await scenario.stop();
  }
});

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string")
    throw new Error("Playwright baseURL is required for the register host origin");
  return new URL(baseURL).origin;
}
