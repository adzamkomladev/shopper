import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../support/e2e";
import {
  newRegistration,
  submitPassword,
  submitSignup,
  verifyFromEmail,
} from "../../../support/publicauth/flow";

// The owner verifies the business for payouts: a submission with something missing points at it, and a whole one
// (each scan sent straight to storage) goes to Shopper, which locks the form until the decision.
test("an owner fills in the business verification and sends it for review", async ({
  page,
  request,
}) => {
  const data = newRegistration();
  await submitSignup(page, data);
  await verifyFromEmail(page, request, data);
  await submitPassword(page);
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Finish later" }).click();
  // The bank list fails at first: the page says so, and Try again recovers it.
  await page.route("**/api/kyb/banks", (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto("/payments/verification");
  await expect(page.getByText("Couldn't load the banks payouts can go to")).toBeVisible();
  await page.unroute("**/api/kyb/banks");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Couldn't load the banks payouts can go to")).toBeHidden();
  await expect(page.getByRole("tab", { name: "Verification" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("Verify your business for payouts")).toBeVisible();
  await expectNoSeriousAxe(page);

  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByLabel("Registered name")).toBeFocused();
  await expect(page.getByText("Enter the registered business name")).toBeVisible();

  await page.getByLabel("Registered name").fill(`${data.shopName} Ltd`);
  await page.getByLabel("Registration number").fill("CS123456789");
  await page.getByLabel("Business TIN").fill("C0012345678");
  await page.getByLabel("Bank or mobile money").click();
  await page.getByRole("option", { name: "GCB Bank" }).click();
  await page.getByLabel("Account or wallet number").fill("1234567890");
  await page.getByLabel("Full name").fill("Ama Mensah");
  await page.getByLabel("Ghana Card number").fill("GHA-123456789-0");
  await page.getByLabel("Card expires on").fill("2031-06-30");
  await upload(page, page.getByLabel("Scan of the card"), "card.png");
  await expect(page.getByText("card.png")).toBeVisible();
  await upload(page, page.getByLabel("Registration certificate", { exact: true }), "reg.pdf");
  await upload(page, page.getByLabel("TIN certificate", { exact: true }), "tin.pdf");
  await expect(page.getByText("tin.pdf")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("With Shopper for review")).toBeVisible();
  await expect(page.getByLabel("Registered name")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Submit for review" })).toHaveCount(0);

  // What was sent is kept: a reload shows the same case, still with Shopper.
  await page.reload();
  await expect(page.getByLabel("Registered name")).toHaveValue(`${data.shopName} Ltd`);
  await expect(page.getByText("With Shopper for review")).toBeVisible();
});

async function upload(page: Page, button: Locator, name: string) {
  const chooser = page.waitForEvent("filechooser");
  await button.click();
  const mimeType = name.endsWith(".pdf") ? "application/pdf" : "image/png";
  await (await chooser).setFiles({ name, mimeType, buffer: Buffer.from(`${name} bytes`) });
}
