import type { Page } from "@playwright/test";

/** Scans stamp their keys from a test clock, so a slow runner cannot turn a scan into typing. Call before `goto`. */
export async function installScanClock(page: Page) {
  await page.addInitScript(() => {
    let now: number | null = null;
    const real = Object.getOwnPropertyDescriptor(Event.prototype, "timeStamp")!;
    Object.defineProperty(Event.prototype, "timeStamp", {
      get() {
        return now ?? real.get!.call(this);
      },
    });
    document.addEventListener(
      "keydown",
      () => {
        if (now !== null) now += 10;
      },
      true,
    );
    Object.assign(window, { scanClock: (value: number | null) => (now = value) });
  });
}

export async function scanCode(page: Page, code: string) {
  await page.evaluate(() => window.scanClock(1_000_000));
  await page.keyboard.type(code);
  await page.keyboard.press("Enter");
  await page.evaluate(() => window.scanClock(null));
}
