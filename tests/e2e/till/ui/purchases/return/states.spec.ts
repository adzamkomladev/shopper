import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../../support/e2e";
import { expectNoOverflow, shoot } from "../../settings/harness";
import { expectTouchTargets } from "../../targets";
import {
  expectInside,
  openDetail,
  openReturn,
  quantity,
  refundButton,
  returnScreen,
  startReturn,
  toast,
} from "../harness";

test("final-sale and returned lines are disabled with their reason", async ({ page }) => {
  await openReturn(page, "return-final");
  const screen = returnScreen(page);
  await expect(quantity(page, "Fan Milk Vanilla ice cream")).toBeDisabled();
  await expect(screen).toContainText("Final sale. This item cannot be returned.");
  await expect(quantity(page, "Gari, white")).toBeDisabled();
  await expect(screen).toContainText("Already returned");
  await expect(quantity(page, "Milo 400g tin")).toBeEnabled();
  await expect(quantity(page, "Milo 400g tin")).toBeFocused();
  await expectNoSeriousAxe(page);
});

test("the detail marks each line Eligible, Final sale or Returned and sums them up", async ({
  page,
}) => {
  await openDetail(page, "return-final");
  const table = page.getByRole("table", { name: "Items purchased" });
  await expect(table.getByText("Final sale", { exact: true })).toBeVisible();
  await expect(table.getByText("Returned 0.5", { exact: true })).toBeVisible();
  await expect(table.getByText("Eligible", { exact: true })).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Items purchased" })).toContainText(
    "2 returnable lines · 1 final-sale line · 1 line returned",
  );
  const eligibility = page.getByRole("region", { name: "Return eligibility" });
  await expect(eligibility).toContainText("2 items eligible for return");
  await expect(eligibility).toContainText("Fan Milk Vanilla ice cream");
  await expect(eligibility).toContainText("Supervisor for policy exceptions");
});

test("the eligibility card lists earlier refunds with their upload state", async ({ page }) => {
  await openDetail(page, "return-history");
  const card = page.getByRole("region", { name: "Return eligibility" });
  await expect(card).toContainText("3 refunds recorded");
  await expect(card).toContainText("Accepted");
  await expect(card).toContainText("Pending upload");
  await expect(card).toContainText("Blocked: Another register refunded this line first.");
  await expectNoSeriousAxe(page);
});

test("with nothing left to return Start return is disabled with the reason", async ({ page }) => {
  await openDetail(page, "return-nothing");
  await expect(startReturn(page)).toBeDisabled();
  await expect(page.getByRole("region", { name: "Return eligibility" })).toContainText(
    "Nothing left to return",
  );
  await page.keyboard.press("Alt+E");
  await expect(toast(page)).toContainText("Nothing left to return");
});

test("a fresh check that finds nothing left shows the empty return screen", async ({ page }) => {
  await openReturn(page, "return-gone", false);
  await expect(returnScreen(page)).toContainText("Nothing left to return");
  await expect(returnScreen(page)).toContainText(
    "Every line is final sale or has already been returned.",
  );
  await expect(refundButton(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Purchase #10482" })).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("the return screen shows a skeleton while the lines load", async ({ page }) => {
  await openReturn(page, "return-loading", false);
  await expect(returnScreen(page).getByRole("status")).toContainText("Loading return");
  await expectNoSeriousAxe(page);
});

test("another register's sale cannot be refunded offline", async ({ page }) => {
  await openReturn(page, "return-offline", false);
  await expect(returnScreen(page)).toContainText(
    "Connect to the internet to refund a sale from another register",
  );
  await expect(refundButton(page)).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Purchase #10482" })).toBeVisible();
});

for (const [width, height, label] of [
  [1920, 1080, "desktop"],
  [1440, 900, "laptop"],
  [1366, 768, "till"],
  [768, 1024, "tablet"],
  [390, 844, "mobile"],
] as const) {
  test(`the detail and the return screen fit at ${label} ${width}x${height}`, async ({
    page,
  }, testInfo) => {
    await openDetail(page, "return-history");
    await page.setViewportSize({ width, height });
    await expectNoOverflow(page);
    await expectTouchTargets(page);
    await shoot(page, testInfo, `detail-${label}`);
    await page.keyboard.press("Alt+E");
    await expect(returnScreen(page)).toBeVisible();
    await page.keyboard.type("1");
    await page.getByRole("textbox", { name: "Reason" }).fill("Damaged");
    await expectNoOverflow(page);
    await expectInside(page, returnScreen(page));
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, testInfo, `return-${label}`);
  });
}
