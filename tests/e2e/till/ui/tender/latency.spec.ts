import { expect, test } from "@playwright/test";
import { productionHarnessUrl, startProductionHarness } from "../../../../support/till/production";
import { calls, openCheckout, openSale } from "../sale/harness";

// Measured on a production build, as a till runs it: the dev server's React is several times slower. The trace
// recorder snapshots the page on every key, which is test cost, not the till's.
let harness: Awaited<ReturnType<typeof startProductionHarness>>;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  harness = await startProductionHarness();
});
test.afterAll(() => harness?.close());
test.use({ baseURL: productionHarnessUrl, trace: "off" });

// A cashier types the cash handed over while the customer waits: each digit must show at once, even on a
// slow till, and nothing may reach the host until Charge.
test("on a 4x slower CPU each tendered digit shows within 50 ms and the host hears nothing until Charge", async ({
  page,
}) => {
  await openSale(page, "lines");
  await openCheckout(page);
  const amount = page.getByRole("textbox", { name: "Amount tendered" });
  await amount.fill("");
  await amount.focus();
  const before = (await calls(page)).length;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Amount tendered"]')!;
    const timings: number[] = [];
    Object.assign(window, { tenderTimings: timings });
    // From the keydown to the first frame that shows the new value.
    addEventListener(
      "keydown",
      () => {
        const shown = input.value;
        const start = performance.now();
        const check = () =>
          input.value === shown
            ? requestAnimationFrame(check)
            : timings.push(performance.now() - start);
        requestAnimationFrame(check);
      },
      true,
    );
  });
  for (const key of "250") await page.keyboard.press(key);
  await expect(amount).toHaveValue("250");
  const timings = await page.evaluate(
    () => (window as unknown as { tenderTimings: number[] }).tenderTimings,
  );
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  expect(timings).toHaveLength(3);
  expect(Math.max(...timings), `each digit, ms: ${timings.join(", ")}`).toBeLessThan(50);
  expect((await calls(page)).length).toBe(before);
  await page.keyboard.press("F5");
  expect(await calls(page, "charge")).toHaveLength(1);
});
