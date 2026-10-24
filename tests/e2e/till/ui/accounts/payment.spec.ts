// Take account payment (Alt+A): find the customer, see what is owed, take cash or MoMo at the drawer.
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { ama, expectFits, shoot, sizes } from "../customers/harness";
import { calls, openFromMenu, openSale } from "../sale/harness";
import { expectTouchTargets } from "../targets";

const form = (page: Page) => page.getByRole("dialog", { name: "Take account payment" });
const phone = (page: Page) => form(page).getByRole("combobox", { name: "Customer phone" });
const amount = (page: Page) => form(page).getByRole("textbox", { name: "Amount (GH₵)" });
const reference = (page: Page) => form(page).getByRole("textbox", { name: "MoMo reference" });
const toast = (page: Page) => page.locator("[data-sonner-toast]");
const payments = async (page: Page) => (await calls(page, "accountPayment")).map((c) => c.args);

/** Alt+A, the number and Enter twice: the customer is chosen and the amount field has focus. */
async function chooseAma(page: Page) {
  await page.keyboard.press("Alt+A");
  await expect(phone(page)).toBeFocused();
  await phone(page).pressSequentially("0241234567", { delay: 15 });
  await page.keyboard.press("Enter");
  await expect(form(page).getByRole("option", { name: /Ama Mensah/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(amount(page)).toBeFocused();
}

test("Alt+A finds a customer by phone, shows what she owes and takes cash with Ctrl+Enter", async ({
  page,
}) => {
  await openSale(page, "payments");
  await chooseAma(page);
  await expect(form(page)).toContainText("Ama Mensah");
  await expect(form(page)).toContainText("Owed");
  await expect(form(page)).toContainText("GH₵ 120.00");
  await expect(form(page).getByRole("button", { name: "Cash" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const submit = form(page).getByRole("button", { name: /^Take payment/ });
  await expect(submit).toBeDisabled();
  await page.keyboard.type("50");
  await expect(submit).toBeEnabled();
  await expect(submit).toHaveAttribute("aria-keyshortcuts", "Control+Enter");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form(page)).toHaveCount(0);
  expect(await payments(page)).toEqual([[{ customerId: ama, method: "cash", amount: 500_000 }]]);
  await expect(toast(page)).toContainText("GH₵ 50.00 from Ama Mensah");
  await expect(toast(page)).toContainText("Slip printed");
  await expect(page.getByRole("combobox", { name: /Scan/ })).toBeFocused();
});

test("the Menu has the entry with its key", async ({ page }) => {
  await openSale(page, "payments");
  await openFromMenu(page, "Take account payment");
  await expect(form(page)).toBeVisible();
  await expect(phone(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(form(page)).toHaveCount(0);
  await page.getByRole("button", { name: /^Menu/ }).click();
  const entry = page
    .getByRole("dialog", { name: "Menu" })
    .getByRole("button", { name: /^Take account payment/ });
  await expect(entry).toHaveAttribute("aria-keyshortcuts", "Alt+A");
  await expect(entry).toContainText("Alt+A");
});

test("an unknown number says so and offers no way to add a customer", async ({ page }) => {
  await openSale(page, "payments");
  await page.keyboard.press("Alt+A");
  await phone(page).fill("0249999999");
  await page.keyboard.press("Enter");
  await expect(form(page)).toContainText("No customer uses this number");
  await expect(form(page).getByRole("textbox", { name: "Name" })).toHaveCount(0);
  await phone(page).fill("12");
  await page.keyboard.press("Enter");
  await expect(form(page)).toContainText("Enter a Ghana mobile number");
});

test("MoMo needs a reference before it can be taken", async ({ page }) => {
  await openSale(page, "payments");
  await chooseAma(page);
  await amount(page).fill("20");
  await form(page).getByRole("button", { name: "MoMo" }).click();
  const submit = form(page).getByRole("button", { name: /^Take payment/ });
  await expect(reference(page)).toBeVisible();
  await expect(submit).toBeDisabled();
  await reference(page).fill("MP260315.1234.A12345");
  await expect(submit).toBeEnabled();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form(page)).toHaveCount(0);
  expect(await payments(page)).toEqual([
    [{ customerId: ama, method: "momo", amount: 200_000, reference: "MP260315.1234.A12345" }],
  ]);
});

test("offline: MoMo and the balance need a connection, but cash is still taken", async ({
  page,
}) => {
  await openSale(page, "payments");
  await page.goto("/harness/index.html?scenario=payments&offline");
  await page.getByRole("heading", { name: "Checkout", exact: true }).waitFor();
  await page.keyboard.press("Alt+A");
  await phone(page).fill("0241234567");
  await page.keyboard.press("Enter");
  await expect(form(page).getByRole("option", { name: /Ama Mensah/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(form(page)).toContainText("Balance needs a connection");
  await expect(form(page).getByRole("button", { name: "MoMo" })).toBeDisabled();
  await expect(form(page).getByText("Needs a connection", { exact: true })).toBeVisible();
  await amount(page).fill("15.50");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form(page)).toHaveCount(0);
  expect(await payments(page)).toEqual([[{ customerId: ama, method: "cash", amount: 155_000 }]]);
});

test("the host's refusal stays in the dialog and a slip that did not print is said", async ({
  page,
}) => {
  await openSale(page, "payments-refused");
  await chooseAma(page);
  await amount(page).fill("10");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form(page).getByRole("alert")).toContainText("The register could not save");
  await expect(form(page)).toBeVisible();

  await openSale(page, "payments-noslip");
  await chooseAma(page);
  await amount(page).fill("10");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(form(page)).toHaveCount(0);
  await expect(toast(page)).toContainText("Slip not printed");
});

test("without customer access there is no entry and Alt+A does nothing", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/harness/index.html?scenario=payments&permissions=sale.create,shift.write");
  await page.getByRole("heading", { name: "Checkout", exact: true }).waitFor();
  await page.keyboard.press("Alt+A");
  await expect(form(page)).toHaveCount(0);
  await page.getByRole("button", { name: /^Menu/ }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Menu" })
      .getByRole("button", { name: /^Take account payment/ }),
  ).toHaveCount(0);
});

for (const size of sizes.filter((s) => s.name !== "1440")) {
  test(`at ${size.name}: the payment dialog fits, passes axe and touch targets`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openSale(page, "payments");
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.keyboard.press("Alt+A");
    await expect(phone(page)).toBeFocused();
    await expectFits(page, size.width);
    await expectNoSeriousAxe(page);
    await shoot(page, `payment-find-${size.name}`);
    await phone(page).pressSequentially("0241234567", { delay: 15 });
    await page.keyboard.press("Enter");
    await expect(form(page).getByRole("option")).toHaveCount(1);
    await expectTouchTargets(page);
    await shoot(page, `payment-match-${size.name}`);
    await page.keyboard.press("Enter");
    await expect(form(page)).toContainText("GH₵ 120.00");
    await amount(page).fill("45.50");
    await expectFits(page, size.width);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `payment-cash-${size.name}`);
    await form(page).getByRole("button", { name: "MoMo" }).click();
    await expect(reference(page)).toBeVisible();
    await expectFits(page, size.width);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `payment-momo-${size.name}`);
  });
}
