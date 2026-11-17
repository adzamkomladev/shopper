import type { Page, Request } from "@playwright/test";

const JOB = "0197a000-0000-7000-8000-0000000000e1";

/** The move views' pre-flight checks: the shop closed since the evening, and no dry run yet. */
export const checks = {
  quiet: { ok: true, lastSaleAt: "2026-11-17T20:41:00.000Z" },
  dryRun: { ok: false, exportJobId: null, sealedAt: null, minutes: null },
};

/** A dry run answered as the API would: sealing on the first read, then the verdict. */
export async function dryRun(page: Page, verdict: Record<string, unknown>, seen: Request[] = []) {
  await page.route(
    (url) => url.pathname.endsWith("/api/migration/dryrun"),
    (route) => {
      seen.push(route.request());
      return route.fulfill({ status: 202, json: { exportJobId: JOB } });
    },
  );
  let reads = 0;
  await page.route(
    (url) => url.pathname.endsWith(`/api/migration/dryrun/${JOB}`),
    (route) =>
      route.fulfill({
        json: reads++ ? { status: "ready", ...verdict } : { status: "running" },
      }),
  );
}

export const passed = {
  verified: true,
  message: null,
  tables: 91,
  rows: 48_213,
  files: 140,
  bytes: 38_000_000,
  minutes: 6,
};
