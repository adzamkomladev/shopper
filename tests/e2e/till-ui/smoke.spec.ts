import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../support/e2e";

test("the till renders @shopper/ui Button and Card with the shared theme", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("region", { name: "About Shopper" });
  await expect(card).toBeVisible();
  const button = page.getByRole("button", { name: "Reload till" });
  await expect(button).toBeVisible();

  // The probe resolves the token the same way the button's own background does.
  const { background, primary } = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.backgroundColor = "var(--primary)";
    const primary = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const button = document.querySelector("button");
    return { background: getComputedStyle(button!).backgroundColor, primary };
  });
  expect(primary).not.toBe("rgba(0, 0, 0, 0)");
  expect(background).toBe(primary);
  await expectNoSeriousAxe(page);
});
