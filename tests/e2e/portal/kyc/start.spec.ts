import { expect, test, type Page } from "@playwright/test";
import { customer, orgId, otpFor, setOrgSettings } from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";

// The owner of E2E Mart is signed in. The one-time codes are read from the Arkesel fake that the portal test
// server sends them through, as a person would read them from their phone.
const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });
const PHONE_SIZES = [
  [1440, 900],
  [390, 844],
] as const;

async function chooseCustomer(page: Page, phone: string) {
  // The heading takes focus when the page opens, which is when K starts to work.
  await expect(heading(page, "Identity checks")).toBeFocused();
  await page.keyboard.press("k");
  const sheet = page.getByRole("dialog", { name: "Start an identity check" });
  await expect(sheet).toBeVisible();
  await page.getByLabel("Customer").click();
  await page.getByRole("option", { name: new RegExp(phone) }).click();
  return sheet;
}

test("K opens the sheet: phone and limit, the code (Alt+R sends another), then the ID can be skipped", async ({
  page,
  request,
}, info) => {
  await setOrgSettings(await orgId(request), { kyc_id_required: false });
  const made = await customer(request);
  await page.goto("/kyc");
  await expect(heading(page, "Identity checks")).toBeVisible();
  const sheet = await chooseCustomer(page, made.phone);
  await expect(sheet.getByLabel("Phone number")).toHaveValue(made.phone);
  await sheet.getByLabel("Credit limit requested (GH₵)").fill("750");
  await shoot(page, info, "kyc-start-phone", { sizes: PHONE_SIZES });
  await page.keyboard.press("Control+Enter");

  await expect(sheet.getByText(`Enter the code sent to ${made.phone}`)).toBeVisible();
  const first = await otpFor(request, made.phone);
  await page.keyboard.press("Alt+r");
  await expect(page.getByText("New code sent")).toBeVisible();
  await sheet.getByLabel("6-digit code").fill(first === "000000" ? "111111" : "000000");
  await page.keyboard.press("Control+Enter");
  await expect(sheet.getByText("That code is not right")).toBeVisible();
  // Toasts fade in and out; axe measures contrast mid-fade as a false failure.
  await expect(page.getByText("New code sent")).toBeHidden({ timeout: 10_000 });
  await shoot(page, info, "kyc-start-code", { sizes: PHONE_SIZES });
  await sheet.getByLabel("6-digit code").fill(await otpFor(request, made.phone, 2));
  await page.keyboard.press("Control+Enter");

  await expect(sheet.getByLabel("ID number")).toBeVisible();
  await shoot(page, info, "kyc-start-id", { sizes: PHONE_SIZES });
  await sheet.getByRole("button", { name: /^Skip/ }).click();
  await expect(heading(page, "Sent for approval", 2)).toBeVisible();
  await shoot(page, info, "kyc-start-done", { sizes: PHONE_SIZES });
  await sheet.getByRole("link", { name: "Open the check" }).click();
  await expect(page).toHaveURL(/\/kyc\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("region", { name: "Check details" })).toContainText("No ID provided");
});

test("when an ID is required Skip is not offered and the number is checked", async ({
  page,
  request,
}) => {
  await setOrgSettings(await orgId(request), { kyc_id_required: true });
  const made = await customer(request);
  await page.goto("/kyc");
  await expect(heading(page, "Identity checks")).toBeVisible();
  const sheet = await chooseCustomer(page, made.phone);
  await sheet.getByLabel("Credit limit requested (GH₵)").fill("100");
  await page.keyboard.press("Control+Enter");
  await sheet.getByLabel("6-digit code").fill(await otpFor(request, made.phone));
  await page.keyboard.press("Control+Enter");
  await expect(sheet.getByLabel("ID number")).toBeVisible();
  await expect(sheet.getByRole("button", { name: /^Skip/ })).toHaveCount(0);
  await sheet.getByLabel("ID type").click();
  await page.getByRole("option", { name: "Ghana Card" }).click();
  await sheet.getByLabel("ID number").fill("12");
  await sheet.getByLabel("Full name on the ID").fill("Ama Mensah");
  await page.keyboard.press("Control+Enter");
  await expect(sheet.getByText("Not a valid number for this ID type")).toBeVisible();
  await sheet.getByLabel("ID number").fill("GHA-123456745-6");
  await page.keyboard.press("Control+Enter");
  await expect(heading(page, "Sent for approval", 2)).toBeVisible();
  await setOrgSettings(await orgId(request), { kyc_id_required: false });
});

test("a phone that isn't a Ghana mobile number is refused before a code is sent", async ({
  page,
  request,
}) => {
  const made = await customer(request);
  await page.goto("/kyc");
  const sheet = await chooseCustomer(page, made.phone);
  await sheet.getByLabel("Phone number").fill("12345");
  await sheet.getByLabel("Credit limit requested (GH₵)").fill("100");
  await page.keyboard.press("Control+Enter");
  await expect(sheet.getByText("Enter a Ghana mobile number like 024 123 4567")).toBeVisible();
  await expect(sheet.getByLabel("Phone number")).toBeFocused();
});
