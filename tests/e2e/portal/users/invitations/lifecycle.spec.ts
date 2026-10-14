import { expect, test, type Page } from "@playwright/test";
import { BOX_API } from "../../../../support/e2e";
import { captureSizes, shopHeaders, unique } from "../../../../support/admin";
import {
  acceptSetupLink,
  chooseByTyping,
  createCustomRole,
  dialog,
  inviteLocal,
  linkParts,
  listInvitations,
  listUsers,
  row,
} from "../../../../support/admin/people";
import { ANNEX, expectNoSeriousAxe, signInWithKeyboard } from "../../../../support/e2e";

const SETUP_LINK = /\/accept-invitation\?.*id=.*token=/;

async function previewStatus(request: Parameters<typeof shopHeaders>[0], setupLink: string) {
  const { id, token } = linkParts(setupLink);
  const response = await request.get(`${BOX_API}/invitations/${id}/preview?token=${token}`, {
    headers: await shopHeaders(request),
  });
  return response.status();
}

async function inviteWithKeyboard(page: Page, email: string, role: string, how: string) {
  const trigger = page.getByRole("button", { name: "Invite user" });
  await expect(trigger).toBeEnabled();
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("i");
  await expect(dialog(page).getByRole("heading", { name: "Invite a user" })).toBeVisible();
  await expect(dialog(page).getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.type(email);
  await page.keyboard.press("Tab");
  await chooseByTyping(page, dialog(page).getByRole("combobox", { name: "Role" }), role);
  await page.keyboard.press("Tab");
  await chooseByTyping(page, dialog(page).getByRole("combobox", { name: "How to send it" }), how);
  await page.keyboard.press("ControlOrMeta+Enter");
}

test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
  });

  test("invite by setup link with the keyboard alone, copy it, and the invitee can use it", async ({
    page,
    request,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const email = `lan-${unique()}@mart.e2e.example`;
    await inviteWithKeyboard(page, email, "inv", "Create");
    const ready = dialog(page);
    await expect(ready.getByRole("heading", { name: "Setup link ready" })).toBeVisible();
    const link = await ready.getByLabel("Setup link").inputValue();
    expect(link).toMatch(SETUP_LINK);
    const copy = ready.getByRole("button", { name: "Copy link" });
    await expect(copy).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Link copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Invite user" })).toBeFocused();
    await expect(page.locator("body")).not.toContainText(linkParts(link).token);

    await acceptSetupLink(request, link, `Zulu LAN ${unique()}`);
    expect((await listUsers(request)).find((user) => user.email === email)?.roleName).toBe(
      "inventory",
    );
    await page.reload();
    const members = page.getByRole("region", { name: "Members" });
    await members.focus();
    await page.keyboard.press("End");
    await expect(members.getByRole("row").filter({ hasText: email })).toContainText("inventory");
  });

  test("an invitation uses the role that was chosen, including a custom one", async ({
    page,
    request,
  }) => {
    const custom = await createCustomRole(request, `Stock taker ${unique()}`, ["stock.read"]);
    await page.reload();
    const email = `custom-${unique()}@mart.e2e.example`;
    await page.getByRole("button", { name: "Invite user" }).click();
    await dialog(page).getByLabel("Email", { exact: true }).fill(email);
    await dialog(page).getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: custom.name }).click();
    await dialog(page).getByRole("combobox", { name: "How to send it" }).click();
    await page.getByRole("option", { name: "Create a setup link" }).click();
    await dialog(page).getByRole("button", { name: "Send invitation" }).click();
    await acceptSetupLink(
      request,
      await dialog(page).getByLabel("Setup link").inputValue(),
      `Custom ${unique()}`,
    );
    expect((await listUsers(request)).find((user) => user.email === email)?.roleName).toBe(
      custom.name,
    );
  });

  test("an emailed invitation shows delivery failure and can be renewed", async ({
    page,
    request,
  }) => {
    const email = `mail-${unique()}@mart.e2e.example`;
    await inviteWithKeyboard(page, email, "acc", "Email");
    await expect(page.getByText(`Invitation created for ${email}`)).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect
      .poll(
        async () =>
          (await listInvitations(request)).find((item) => item.email === email)?.deliveryStatus,
      )
      .toBe("failed");
    await page.reload();
    const invitation = row(page, email);
    await expect(invitation).toContainText("Pending");
    await expect(invitation).toContainText("accountant");
    await expect(invitation).toContainText("Email not delivered");
    await page.getByRole("button", { name: `Resend invitation to ${email}` }).click();
    await expect(page.getByText(`Invitation renewed for ${email}`)).toBeVisible();
  });

  test("a new link replaces the old one, which stops working", async ({ page, request }) => {
    const email = `new-link-${unique()}@mart.e2e.example`;
    const first = await inviteLocal(request, email, "cashier");
    await page.reload();
    await page.getByRole("button", { name: `New link for ${email}` }).click();
    const link = await dialog(page).getByLabel("Setup link").inputValue();
    expect(link).toMatch(SETUP_LINK);
    expect(link).not.toBe(first.setupLink);
    expect(await previewStatus(request, first.setupLink!)).toBeGreaterThanOrEqual(400);
    expect(await previewStatus(request, link)).toBe(200);
  });

  test("cancelling asks first: Escape keeps it, confirming ends the link", async ({
    page,
    request,
  }) => {
    const email = `cancel-${unique()}@mart.e2e.example`;
    const invitation = await inviteLocal(request, email, "cashier");
    await page.reload();
    const trigger = page.getByRole("button", { name: `Cancel invitation for ${email}` });
    await trigger.click();
    await expect(
      dialog(page).getByRole("heading", { name: `Cancel invitation for ${email}?` }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(row(page, email)).toContainText("Pending");

    await trigger.click();
    await dialog(page).getByRole("button", { name: "Cancel invitation", exact: true }).click();
    await expect(page.getByText("Invitation cancelled")).toBeVisible();
    await expect(row(page, email)).toContainText("Cancelled");
    expect(await previewStatus(request, invitation.setupLink!)).toBeGreaterThanOrEqual(400);
  });

  test("a bad email and a missing role are refused on their own fields", async ({ page }) => {
    await page.getByRole("button", { name: "Invite user" }).click();
    await dialog(page).getByLabel("Email", { exact: true }).fill("not-an-email");
    await dialog(page).getByRole("button", { name: "Send invitation" }).click();
    const field = dialog(page).getByLabel("Email", { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toBeFocused();
    await field.fill("fine@mart.e2e.example");
    await dialog(page).getByRole("button", { name: "Send invitation" }).click();
    await expect(dialog(page).getByRole("combobox", { name: "Role" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(dialog(page)).toContainText("Choose a role");
  });

  test("offline disables Send invitation with the reason", async ({ page, context }, info) => {
    await page.getByRole("button", { name: "Invite user" }).click();
    const send = dialog(page).getByRole("button", { name: "Send invitation" });
    await context.setOffline(true);
    await expect(send).toBeDisabled();
    await expect(send).toHaveAccessibleDescription(/offline/i);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-invitation-offline", async () => {
      await expect(send).toBeDisabled();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });

  test("the invite sheet and the setup-link dialog have no serious axe violations", async ({
    page,
  }, info) => {
    await page.getByRole("button", { name: "Invite user" }).click();
    await expectNoSeriousAxe(page);
    await dialog(page)
      .getByLabel("Email", { exact: true })
      .fill(`axe-${unique()}@mart.e2e.example`);
    await dialog(page).getByRole("combobox", { name: "Role" }).click();
    await page.getByRole("option", { name: "cashier" }).click();
    await dialog(page).getByRole("combobox", { name: "How to send it" }).click();
    await page.getByRole("option", { name: "Create a setup link" }).click();
    await dialog(page).getByRole("button", { name: "Send invitation" }).click();
    await expect(dialog(page).getByRole("heading", { name: "Setup link ready" })).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-setup-link", async () => {
      await expect(dialog(page).getByRole("heading", { name: "Setup link ready" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});

test.describe("a shop that has invited nobody", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("says so and offers to invite", async ({ page }, info) => {
    await signInWithKeyboard(page, ANNEX);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "No invitations yet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite user" })).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "users-no-invitations", async () => {
      await expect(page.getByRole("heading", { name: "No invitations yet" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
