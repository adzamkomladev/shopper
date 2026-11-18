import { expect, test, type ConsoleMessage } from "@playwright/test";
import { shoot } from "../../../support/customers/shots";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// v1.5 Day 46: a relay org's cloud back office only reads. Its shell says why on every screen, for every member; the
// integration tests drive the real refusal (423) and the database lock.
test.describe.configure({ timeout: 180_000 });

const status = { readOnly: false, licence: null, move: null, onPrem: null };

test("a relay org's portal tells every member the box makes the changes", async ({
  page,
}, info) => {
  const errors: ConsoleMessage[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message));
  await replay(page, "/billing/status", { ...status, relay: true });
  await page.goto("/products");
  await expect(heading(page, /Products/)).toBeVisible();
  const banner = page.getByRole("status").filter({ hasText: "runs on its own box" });
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("make changes on the box");
  // The banner rides the shell: it stays on the next screen too.
  await page.goto("/customers");
  await expect(banner).toBeVisible();
  await shoot(page, info, "relay-banner", { sizes: SIZES });
  expect(errors.map((message) => message.text())).toEqual([]);
});

test("a full shop shows no relay banner", async ({ page }) => {
  await replay(page, "/billing/status", { ...status, relay: false });
  await page.goto("/products");
  await expect(heading(page, /Products/)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "runs on its own box" })).toHaveCount(0);
});
