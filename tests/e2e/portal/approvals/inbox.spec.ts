import { expect, test, type Page, type Request } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import { shoot } from "../../../support/customers/shots";
import { busyApprovals } from "../../../support/payments/manage";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// The owner of E2E Mart is signed in. Two pending requests are replayed; decisions answer as the API would.
test.describe.configure({ timeout: 180_000 });

const decide = (page: Page, posted: Request[]) =>
  page.route(
    (url) => /\/api\/approvals\/[^/]+\/decision$/.test(url.pathname),
    (route) => {
      posted.push(route.request());
      const body = route.request().postDataJSON() as { decision: string; reason?: string };
      const row = busyApprovals().approvals.find((item) =>
        route.request().url().includes(item.id),
      )!;
      return route.fulfill({
        json: { ...row, status: body.decision, declineReason: body.reason ?? null },
      });
    },
  );

test("pending requests list what, how much, why and how long they have left", async ({
  page,
}, info) => {
  await replay(page, "/approvals", busyApprovals());
  await page.goto("/approvals");
  await expect(heading(page, "Approvals")).toBeVisible();
  const list = page.getByRole("list", { name: "Pending approvals" });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(list.getByRole("listitem").first()).toContainText("Refund of GH₵ 45.00");
  await expect(list.getByRole("listitem").first()).toContainText("dented tin of milk");
  await expect(list.getByRole("listitem").first()).toContainText(/\d min left/);
  await shoot(page, info, "approvals-busy", { sizes: SIZES });
});

test("A approves the first request and D declines the next with a reason", async ({ page }) => {
  const posted: Request[] = [];
  await replay(page, "/approvals", busyApprovals());
  await decide(page, posted);
  await page.goto("/approvals");
  await expect(heading(page, "Approvals")).toBeVisible();
  await page.keyboard.press("a");
  await expect(page.getByText("Approved. The till can go ahead.")).toBeVisible();
  expect(posted[0]!.postDataJSON()).toEqual({ decision: "approved" });
  const list = page.getByRole("list", { name: "Pending approvals" });
  await expect(list.getByRole("listitem")).toHaveCount(1);
  // Focus moves to the next request, so the shortcuts keep working.
  await expect(page.getByRole("button", { name: /Approve discount/ })).toBeFocused();

  await page.keyboard.press("d");
  const dialog = page.getByRole("dialog", { name: "Decline the request" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Reason (optional)").fill("Price was already reduced");
  await dialog.getByRole("button", { name: "Decline" }).click();
  await expect(page.getByText("Declined. The till has been told.")).toBeVisible();
  expect(posted[1]!.postDataJSON()).toEqual({
    decision: "declined",
    reason: "Price was already reduced",
  });
});

test("an empty inbox says nothing is waiting", async ({ page }, info) => {
  await replay(page, "/approvals", { approvals: [] });
  await page.goto("/approvals");
  await expect(heading(page, "Approvals")).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Nothing waiting for you");
  await shoot(page, info, "approvals-empty", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
});

test("without refund.approve there is no link and the page says why", async ({ page, request }) => {
  const cashier = await createStaff(request, "cashier", "Inbox");
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await expect(page.getByRole("link", { name: "Approvals" })).toHaveCount(0);
  await page.goto("/approvals");
  await expect(page.getByRole("main")).toContainText("You don't have permission");
});
