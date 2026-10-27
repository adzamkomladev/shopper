// Asking a manager who is not at the register: the request waits for a back-office answer, and only an approval
// for this refund lets it through. The harness answers in place of the host after one status check.
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../../support/e2e";
import { calls } from "../../sale/harness";
import { expectNoOverflow, shoot } from "../../settings/harness";
import { expectTouchTargets } from "../../targets";
import { expectInside, openReturn, refundButton, returnScreen, toast } from "../harness";

const approvalId = "10000000-0000-7000-8000-000000000090";

/** One Milo tin back for "Wrong size", cash, then the remote tab with Alt+R. */
async function askRemotely(page: Page, scenario: string) {
  await openReturn(page, scenario);
  await page.keyboard.type("1");
  await page.getByRole("textbox", { name: "Reason" }).fill("Wrong size");
  await page.keyboard.press("Alt+1");
  await page.keyboard.press("Alt+R");
  await expect(page.getByRole("tab", { name: /Ask remotely/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(returnScreen(page)).toContainText(
    "A manager can approve this refund from the back office.",
  );
  await expect(refundButton(page)).toBeDisabled();
  await page.keyboard.press("Alt+A");
}

test("a refund approved from the back office goes through with the approval, keyboard only", async ({
  page,
}) => {
  await askRemotely(page, "return-remote");
  await expect(returnScreen(page)).toContainText("Waiting for a manager to answer");
  await expect(returnScreen(page)).toContainText("Wait for a manager to approve this refund");
  await expect(returnScreen(page)).toContainText("A manager approved this refund.");
  await expect(refundButton(page)).toBeEnabled();
  await expectNoSeriousAxe(page);
  const [asked] = await calls(page, "approval.remote.request");
  expect(asked!.args[0]).toMatchObject({ kind: "refund", reason: "Wrong size" });
  await page.keyboard.press("ControlOrMeta+Enter");

  await expect(page.getByRole("heading", { name: "Purchase #10482" })).toBeVisible();
  await expect(toast(page)).toContainText("recorded");
  const refunds = await calls(page, "refund");
  expect(refunds.at(-1)!.args[0]).toMatchObject({ approval: { approvalId } });
});

test("a refusal of the approved refund shows in the remote panel and can be asked again", async ({
  page,
}) => {
  await askRemotely(page, "return-remote-used");
  await expect(returnScreen(page)).toContainText("A manager approved this refund.");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(returnScreen(page)).toContainText("This approval was already used. Ask again.");
  await expect(page.getByRole("button", { name: /Ask again/ })).toBeEnabled();
  await expect(refundButton(page)).toBeDisabled();
});

test("a changed refund after approval has to be asked again", async ({ page }) => {
  await askRemotely(page, "return-remote");
  await expect(returnScreen(page)).toContainText("A manager approved this refund.");
  await page
    .getByRole("textbox", { name: "Quantity to return, Voltic natural water 1.5L" })
    .fill("1");
  await expect(returnScreen(page)).toContainText(
    "The refund changed after the manager approved it. Ask again.",
  );
  await expect(refundButton(page)).toBeDisabled();
});

test("a declined request shows the manager's reason and can be asked again", async ({ page }) => {
  await askRemotely(page, "return-remote-declined");
  await expect(returnScreen(page)).toContainText(
    "A manager declined this refund: The tin is not damaged",
  );
  await expect(page.getByRole("button", { name: /Ask again/ })).toBeEnabled();
  await expect(refundButton(page)).toBeDisabled();
});

test("an unanswered request says it expired", async ({ page }) => {
  await askRemotely(page, "return-remote-expired");
  await expect(returnScreen(page)).toContainText("No manager answered within 10 minutes.");
  await expect(refundButton(page)).toBeDisabled();
});

test("offline, asking says why and the refund stays blocked", async ({ page }) => {
  await askRemotely(page, "return-remote-offline");
  await expect(returnScreen(page)).toContainText(
    "Connect to the internet to ask a manager remotely",
  );
  await expect(refundButton(page)).toBeDisabled();
  // The manager-here tab still works without a connection.
  await page.keyboard.press("Alt+P");
  await expect(page.getByRole("combobox", { name: "Manager" })).toBeVisible();
});

for (const [width, height, label] of [
  [1920, 1080, "desktop"],
  [1440, 900, "laptop"],
  [1366, 768, "till"],
  [768, 1024, "tablet"],
  [390, 844, "mobile"],
] as const) {
  test(`waiting and declined fit at ${label} ${width}x${height}`, async ({ page }, testInfo) => {
    await askRemotely(page, "return-remote-declined");
    await expect(returnScreen(page)).toContainText("A manager declined this refund");
    await page.setViewportSize({ width, height });
    await expectNoOverflow(page);
    await expectInside(page, returnScreen(page));
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await page.getByRole("region", { name: "Refund summary" }).scrollIntoViewIfNeeded();
    await shoot(page, testInfo, `remote-declined-${label}`);
  });
}
