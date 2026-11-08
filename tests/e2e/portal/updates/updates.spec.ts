import { expect, test, type Page, type Request } from "@playwright/test";
import { shoot } from "../../../support/customers/shots";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// On a box the Billing page holds the licence and the update bundles. The box's answers are replayed; the integration
// tests drive the real service and helper.
test.describe.configure({ timeout: 120_000 });

const request = "eyJtYWNoaW5lIjoiYWJjZGVmIiwia2V5IjoiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVoifQ";
const licence = {
  state: "valid",
  locksAt: new Date(Date.now() + 40 * 86_400_000).toISOString(),
  checkedInAt: new Date().toISOString(),
  licence: {
    id: "019a5e2c-7d1b-7c3e-9f2a-8b4d6e1f0a37",
    site: "E2E Mart, Osu",
    terminals: 5,
    maintenanceUntil: "2026-12-01",
  },
  request,
};
const ok = {
  file: "shopper-update-1.1.0.tgz",
  kind: "update",
  version: "1.1.0",
  builtAt: "2026-11-10T08:00:00.000Z",
  verdict: { ok: true },
};
const late = {
  file: "shopper-update-1.2.0.tgz",
  kind: "update",
  version: "1.2.0",
  builtAt: "2027-01-05T08:00:00.000Z",
  verdict: {
    ok: false,
    reason: "maintenance",
    message:
      "This update was built on 5 Jan 2027, after your updates ended on 1 Dec 2026. Renew support to install it.",
  },
};
const pack = {
  file: "shopper-taxpack-2027.01.tgz",
  kind: "taxpack",
  version: "2027.01",
  builtAt: "2027-01-05T08:00:00.000Z",
  verdict: { ok: true },
};
const running = { version: "1.0.0", slot: "a" };

async function open(
  page: Page,
  updates: unknown,
  installs: Request[] = [],
  cancels: Request[] = [],
) {
  await replay(page, "/billing/status", { readOnly: false, licence: { state: "valid" } });
  await replay(page, "/billing", { subscription: null, invoices: [], licence });
  await replay(page, "/updates", updates);
  await page.route(
    (url) => url.pathname === "/api/updates/install",
    (route) => {
      installs.push(route.request());
      const body = route.request().postDataJSON() as { file: string; at?: string };
      const at = body.at;
      if (body.file === pack.file)
        return route.fulfill({
          status: 200,
          json: { status: "applied", file: pack.file, rules: 2 },
        });
      return route.fulfill({
        status: at ? 201 : 202,
        json: { status: at ? "scheduled" : "started", file: ok.file, at },
      });
    },
  );
  await page.route(
    (url) => url.pathname === "/api/updates/cancel",
    (route) => {
      cancels.push(route.request());
      return route.fulfill({ status: 204 });
    },
  );
  await page.goto("/billing");
  await expect(heading(page, "Billing")).toBeVisible();
}

test("a bundle covered by the licence installs now, after a confirmation; one built after the updates date says why not", async ({
  page,
}, info) => {
  const installs: Request[] = [];
  await open(page, { running, bundles: [late, ok] }, installs);
  const card = page.getByText("Running 1.0.0").locator("xpath=ancestor::*[@data-slot='card']");
  await expect(card).toContainText("Slot A");
  await expect(card).toContainText("after your updates ended on 1 Dec 2026");
  // The refused bundle has no buttons; the covered one has both.
  await expect(page.getByRole("button", { name: "Install now" })).toHaveCount(1);
  await shoot(page, info, "updates-list", { sizes: SIZES });
  await page.getByRole("button", { name: "Install now" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("makes a verified backup");
  await page.getByRole("button", { name: "Not now" }).click();
  expect(installs).toHaveLength(0);
  await page.getByRole("button", { name: "Install now" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Install" }).click();
  await expect(page.getByText("Installing. The box restarts in a moment.")).toBeVisible();
  expect(installs).toHaveLength(1);
  expect(installs[0]!.postDataJSON()).toEqual({ file: ok.file });
});

test("a tax rule pack applies at once after a confirmation, even when updates have ended", async ({
  page,
}, info) => {
  const installs: Request[] = [];
  await open(page, { running, bundles: [late, pack] }, installs);
  // A pack is never scheduled: it has one action, and the refused update beside it has none.
  await expect(page.getByRole("button", { name: "After closing" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Install now" })).toHaveCount(0);
  await shoot(page, info, "updates-taxpack", { sizes: SIZES });
  await page.getByRole("button", { name: "Apply tax rules" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alertdialog")).toContainText("does not restart");
  await expect(page.getByRole("alertdialog")).toContainText("with other rates is replaced");
  await page.getByRole("button", { name: "Not now" }).click();
  expect(installs).toHaveLength(0);
  await page.getByRole("button", { name: "Apply tax rules" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Tax rules 2027.01 applied: 2 rules changed.")).toBeVisible();
  expect(installs[0]!.postDataJSON()).toEqual({ file: pack.file });
});

test("after closing: the time defaults to tonight 23:00 and the schedule can be cancelled", async ({
  page,
}, info) => {
  const installs: Request[] = [];
  const cancels: Request[] = [];
  await open(page, { running, bundles: [ok] }, installs, cancels);
  await page.getByRole("button", { name: "After closing" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Install at")).toHaveValue(/T23:00$/);
  await shoot(page, info, "updates-schedule", { sizes: SIZES });
  await dialog.getByLabel("Install at").fill("2020-01-01T10:00");
  await expect(dialog.getByText("Pick a time that has not passed")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Schedule" })).toBeDisabled();
  await dialog
    .getByLabel("Install at")
    .fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16));
  await dialog.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByText("Update scheduled.")).toBeVisible();
  expect((installs[0]!.postDataJSON() as { at: string }).at).toMatch(/Z$/);

  const at = new Date(Date.now() + 2 * 86_400_000).toISOString();
  await page.unroute((url) => url.pathname.endsWith("/api/updates")).catch(() => undefined);
  await replay(page, "/updates", { running, bundles: [ok], scheduled: { file: ok.file, at } });
  await page.reload();
  await expect(page.getByText("installs")).toBeVisible();
  // One schedule at a time: the bundle's buttons wait for the cancel.
  await expect(page.getByRole("button", { name: "Install now" })).toBeDisabled();
  await shoot(page, info, "updates-scheduled", { sizes: SIZES });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect.poll(() => cancels.length).toBe(1);
});

test("the last attempt's result, and an empty folder", async ({ page }, info) => {
  await open(page, {
    running,
    bundles: [],
    last: {
      status: "rolled_back",
      version: "1.1.0",
      at: "2026-11-10T23:05:00.000Z",
      message:
        "1.1.0 did not start: migration 0042_tax failed: division by zero. The box is back on slot a. The update changed nothing in the database.",
    },
  });
  await expect(page.getByText("Update rolled back")).toBeVisible();
  // The box says why, in its own words.
  await expect(page.getByText("division by zero", { exact: false })).toBeVisible();
  await expect(page.getByText("No update bundles yet")).toBeVisible();
  await shoot(page, info, "updates-rolled-back", { sizes: SIZES });
});

test("the cloud has no updates: the Billing page shows no updates card", async ({ page }) => {
  await replay(page, "/billing/status", { readOnly: false, licence: { state: "valid" } });
  await replay(page, "/billing", { subscription: null, invoices: [], licence });
  await page.route(
    (url) => url.pathname === "/api/updates",
    (route) => route.fulfill({ status: 404, json: { error: "Not found" } }),
  );
  await page.goto("/billing");
  await expect(page.getByRole("main")).toContainText("E2E Mart, Osu");
  await expect(page.getByText("Running ")).toHaveCount(0);
});
