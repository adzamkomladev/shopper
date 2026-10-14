import { expect, test } from "@playwright/test";
import { captureSizes, unique } from "../../../../support/admin";
import { inviteLocal, listInvitations, row } from "../../../../support/admin/people";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expireLink } from "../../../../support/publicauth/expiry";

test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  });

  test("an invitation with persisted expired status has no open actions", async ({
    page,
    request,
  }, info) => {
    const email = `expired-${unique()}@mart.e2e.example`;
    const invitation = await inviteLocal(request, email, "cashier");
    await expireLink("invitation", invitation.id, true);
    expect((await listInvitations(request)).find((item) => item.id === invitation.id)?.status).toBe(
      "expired",
    );
    await page.reload();
    const expiredRow = row(page, email);
    await expect(expiredRow).toContainText("Expired");
    await expect(page.getByRole("button", { name: `New link for ${email}` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Cancel invitation for ${email}` })).toHaveCount(
      0,
    );
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-invitation-persisted-expired", async () => {
      await expect(expiredRow).toContainText("Expired");
      await expect(page.getByRole("button", { name: `New link for ${email}` })).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: `Cancel invitation for ${email}` }),
      ).toHaveCount(0);
      await expectNoSeriousAxe(page);
    });
  });
});
