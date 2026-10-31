// Day 26: five wrong PINs lock a cashier; the Users screen shows until when, and Unlock lifts it at once.
import { expect, test } from "@playwright/test";
import { captureSizes, enrolDevice, post, unique } from "../../../support/admin";
import { branchIdNamed, cashierLogin } from "../../../support/admin/devices";
import { createStaff, row } from "../../../support/admin/people";
import { BRANCH_NAME, expectNoSeriousAxe } from "../../../support/e2e";

test("a locked cashier shows Locked until; Unlock confirms, clears the badge and lets the PIN in", async ({
  page,
  request,
}, info) => {
  const cashier = await createStaff(request, "cashier", "Yaw");
  const till = (await enrolDevice(
    request,
    await branchIdNamed(request, BRANCH_NAME),
    `Till ${unique()}`,
  )) as { deviceId: string; deviceToken: string };
  await post(request, "/cashiers/pin", { userId: cashier.userId, pin: "582913" });
  for (let attempt = 0; attempt < 5; attempt += 1)
    expect((await cashierLogin(request, till, cashier.userId, "000000")).status()).toBe(401);
  expect((await cashierLogin(request, till, cashier.userId, "582913")).status()).toBe(429);

  await page.goto("/users");
  await expect(row(page, cashier.name)).toContainText(/Locked until \d\d:\d\d/);
  await expectNoSeriousAxe(page);
  await captureSizes(page, info, "users-locked", async () => {
    await expect(row(page, cashier.name)).toContainText("Locked until");
  });

  await page.getByRole("button", { name: `Unlock ${cashier.name}` }).click();
  const confirm = page.getByRole("dialog", { name: `Unlock ${cashier.name}?` });
  await expect(confirm).toContainText("Their PIN and password stay the same.");
  await expectNoSeriousAxe(page);
  await confirm.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByText(`${cashier.name} unlocked`)).toBeVisible();
  await expect(row(page, cashier.name)).not.toContainText("Locked until");
  await expect(page.getByRole("button", { name: `Unlock ${cashier.name}` })).toHaveCount(0);
  expect((await cashierLogin(request, till, cashier.userId, "582913")).status()).toBe(200);
});
