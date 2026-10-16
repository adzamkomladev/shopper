import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { openSale } from "./harness";

test("MoMo pending, confirmed, failed and expired states remain visible and retryable", async ({
  page,
}) => {
  for (const [scenario, state] of [
    ["momo-pending", "Waiting for customer approval"],
    ["momo-confirmed", "Mobile money confirmed"],
    ["momo-failed", "Mobile money payment failed"],
    ["momo-expired", "Mobile money request expired"],
  ] as const) {
    await openSale(page, scenario);
    await expect(page.getByRole("region", { name: "Tender" })).toContainText(state);
    await expectNoSeriousAxe(page);
  }
  await page.getByRole("button", { name: "Retry payment" }).click();
  await expect(page.getByRole("dialog", { name: "Mobile money payment" })).toBeVisible();
});

test("OTP failure is shown only for the matching current MoMo status", async ({ page }) => {
  await openSale(page, "momo-otp-error");
  await expect(page.getByRole("alert")).toContainText("Incorrect one-time code.");

  await openSale(page, "momo-stale-otp-error");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Waiting for customer approval")).toBeVisible();

  await openSale(page, "momo-pending");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await openSale(page, "momo-confirmed");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a confirmed payment notice is an orphan only when no current tender matches it", async ({
  page,
}) => {
  await openSale(page, "momo-confirmed");
  await expect(page.getByText("MoMo confirmed — not yet applied to a sale")).toHaveCount(0);

  await openSale(page, "momo-orphan-confirmed");
  await expect(page.getByText("MoMo confirmed — not yet applied to a sale")).toBeVisible();
});
