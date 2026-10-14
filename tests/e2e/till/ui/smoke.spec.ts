import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../support/e2e";

test("the till connection screen uses shared UI controls and theme tokens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Register connection" })).toBeVisible();
  const host = page.getByRole("region", { name: "Host connection" });
  await expect(host).toBeVisible();
  const connect = host.getByRole("button", { name: /Connect register/ });
  await expect(connect).toBeVisible();

  const { background, primary } = await connect.evaluate((button) => {
    const probe = document.body.appendChild(document.createElement("div"));
    probe.style.backgroundColor = "var(--primary)";
    const primary = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { background: getComputedStyle(button).backgroundColor, primary };
  });
  expect(primary).not.toBe("rgba(0, 0, 0, 0)");
  expect(background).toBe(primary);
  await expectNoSeriousAxe(page);
});
