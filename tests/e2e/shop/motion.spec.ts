// The shop's micro-interactions play, and reduced motion turns them off without hiding anything.
import { expect, test } from "@playwright/test";
import { replayAccount, signIn, startShopper } from "../../support/shop/browser";

const longest = () =>
  Math.max(
    0,
    ...document
      .getAnimations()
      .map((animation) => Number(animation.effect?.getTiming().duration ?? 0)),
  );

test("points count up and receipts rise in", async ({ page }) => {
  const { phone } = await startShopper(page);
  await replayAccount(page);
  await signIn(page, phone);
  const counter = page.locator(".count-up-grouped");
  await expect(counter).toHaveCSS("animation-name", "count");
  await expect(page.locator(".rise-stagger").first()).toHaveCSS("animation-name", "rise");
  // Settled, the counter shows the balance.
  await expect
    .poll(() => counter.evaluate((node) => getComputedStyle(node).counterReset))
    .toBe("thousands 1 count 240");
});

test("with reduced motion every animation is instant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { phone } = await startShopper(page);
  await replayAccount(page);
  await signIn(page, phone);
  await expect(page.getByRole("region", { name: "Your points" })).toContainText("1,240");
  expect(await page.evaluate(longest)).toBeLessThan(1);
});
