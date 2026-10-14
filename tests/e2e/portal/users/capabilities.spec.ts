import { expect, test } from "@playwright/test";
import { unique } from "../../../support/admin";
import {
  allPermissionCodes,
  chooseByTyping,
  createCustomRole,
  createStaff,
  dialog,
  inviteLocal,
  listUsers,
  row,
  signInAs,
} from "../../../support/admin/people";
import { expectNoSeriousAxe } from "../../../support/e2e";

// The server wants role.write to change anyone's role, and user.write on top of it to invite. The
// screen offers exactly what the server will accept, so nothing is a button that only fails.
test.describe("capabilities that differ from the owner's", () => {
  test("role.write without user.write can change a role but not invite", async ({
    page,
    request,
  }) => {
    const codes = (await allPermissionCodes(request)).filter((code) => code !== "user.write");
    const role = await createCustomRole(request, `Role changer ${unique()}`, codes);
    const changer = await createStaff(request, role.name, "Adwoa");
    const member = await createStaff(request, "cashier", "Kwesi");
    const pending = `pending-${unique()}@mart.e2e.example`;
    await inviteLocal(request, pending, "cashier");

    await page.context().clearCookies();
    await signInAs(page, changer);
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "Users", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite user" })).toHaveCount(0);
    await page.keyboard.press("i");
    await expect(dialog(page)).toHaveCount(0);
    await expect(row(page, pending)).toContainText("Pending");
    await expect(page.getByRole("button", { name: `New link for ${pending}` })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: `Cancel invitation for ${pending}` }),
    ).toHaveCount(0);

    const trigger = page.getByRole("button", { name: `Change role for ${member.name}` });
    await trigger.click();
    await chooseByTyping(page, dialog(page).getByRole("combobox", { name: "Role" }), "acc");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Role updated")).toBeVisible();
    await expect(row(page, member.name)).toContainText("accountant");
    expect((await listUsers(request)).find((user) => user.id === member.userId)?.roleName).toBe(
      "accountant",
    );
    await expectNoSeriousAxe(page);
  });

  test("user.write without role.write can't invite or change a role, and the page says so", async ({
    page,
    request,
  }) => {
    const role = await createCustomRole(request, `People viewer ${unique()}`, [
      "user.read",
      "user.write",
      "role.read",
    ]);
    const viewer = await createStaff(request, role.name, "Araba");
    const member = await createStaff(request, "cashier", "Kojo");

    await page.context().clearCookies();
    await signInAs(page, viewer);
    await page.goto("/users");
    await expect(row(page, member.name)).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite user" })).toHaveCount(0);
    await page.keyboard.press("i");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Change role for / })).toHaveCount(0);
    await expect(page.getByText(/You can see who has access/)).toBeVisible();
    await expectNoSeriousAxe(page);
  });
});
