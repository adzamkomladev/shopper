// Closing over the variance threshold: the manager, the PIN and the refusals the host can give.
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import {
  approve,
  count,
  flow,
  openShiftScreen,
  shiftCalls,
  shoot,
  startClose,
  step,
  submitTotals,
  variances,
} from "./harness";

test("a count over the threshold shows the variances and asks a manager before closing", async ({
  page,
}, testInfo) => {
  await startClose(page);
  await submitTotals(page, async () => {
    await count(page, "200").fill("1");
    await count(page, "10").fill("3");
  });
  await expect(step(page, "Result")).toHaveAttribute("aria-current", "step");
  await expect(variances(page).getByRole("row", { name: /^Cash/ })).toContainText(
    "Short GH₵ 10.00",
  );
  await expect(flow(page)).toContainText("A manager must approve a variance above GH₵ 5.00");
  await expect(flow(page)).toContainText("The count is final");
  const close = page.getByRole("button", { name: /^Close shift/ });
  await expect(close).toBeDisabled();
  const manager = page.getByRole("combobox", { name: "Manager" });
  await manager.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(manager).toContainText("Kofi Mensah");
  await page.keyboard.press("Tab");
  await page.keyboard.type("0000");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "close-approval-1366");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("alert").filter({ hasText: "Wrong PIN" })).toHaveText(
    "Wrong PIN. 4 tries left",
  );
  await expect(page.getByLabel("Manager PIN")).toBeFocused();
  await page.keyboard.type("4321");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("region", { name: "Z report" })).toBeVisible();
  expect((await shiftCalls(page, "shiftClose")).at(-1)).toEqual([
    { approverId: "10000000-0000-7000-8000-000000000020", pin: "4321" },
  ]);
  await expect(page.getByRole("region", { name: "Z report" })).toContainText("Approved by");
});

for (const [scenario, message] of [
  ["shift-close-locked", "Too many attempts. Try again in 15 minutes."],
  ["shift-close-forbidden", "This person cannot approve that"],
] as const)
  test(`a refused approval (${scenario}) stays on the Result with the host's words`, async ({
    page,
  }) => {
    await startClose(page, scenario);
    await submitTotals(page, async () => {
      await count(page, "200").fill("1");
    });
    await approve(page, "4321");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();
    await expect(page.getByRole("region", { name: "Z report" })).toHaveCount(0);
  });

test("a register with no manager to approve says so instead of an empty list", async ({ page }) => {
  await startClose(page, "shift-close-no-approvers");
  await submitTotals(page, async () => {
    await count(page, "200").fill("1");
  });
  await expect(page.getByText("Connect to load manager approvals")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Close shift/ })).toBeDisabled();
});

test("a counted register that was reloaded closes from the Shift screen", async ({ page }) => {
  await openShiftScreen(page, "shift-counting");
  await expect(
    page.getByRole("main", { name: "Shift" }).getByText("The drawer is counted. Close the shift"),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Close shift/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Print X report/ })).toHaveCount(0);
  await page.keyboard.press("Alt+Z");
  expect(await shiftCalls(page, "shiftClose")).toEqual([[]]);
  await expect(flow(page)).toContainText("A manager must approve the close");
  await approve(page, "4321");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByRole("region", { name: "Z report" })).toBeVisible();
});
