// A shopper signs in to E2E Mart with a code texted to their phone (read from the shop host's Arkesel fake).
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../support/e2e";
import { SHOP, signIn, startShopper, textedCode, textsTo } from "../../support/shop/browser";

const code = (page: import("@playwright/test").Page) => page.getByLabel("Sign-in code");

test("the shop's link signs a new phone in and opens an empty account", async ({ page }) => {
  const { phone } = await startShopper(page);
  await page.goto(`/${SHOP}`);
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/signin$`));
  await expect(page).toHaveTitle("E2E Mart · Your receipts");
  await expect(page.getByRole("heading", { name: "See your receipts and points" })).toBeVisible();
  await expectNoSeriousAxe(page);

  await page.getByLabel("Phone number").fill(`+233 ${phone.slice(1, 3)} ${phone.slice(3)}`);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Enter your code" })).toBeVisible();
  await expect(page.getByText(`${phone.slice(0, 3)} *** ${phone.slice(-4)}`)).toBeVisible();
  await expect(code(page)).toBeFocused();
  await expectNoSeriousAxe(page);

  // No button: the sixth digit submits.
  await page.keyboard.type(await textedCode(phone));
  await expect(page.getByRole("heading", { name: "You are in" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/account$`));
  await expect(page.getByRole("heading", { name: "Hi there" })).toBeVisible();
  await expect(page.getByText("No receipts yet")).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("a wrong code says how many tries are left, and five lock the code until a new one is sent", async ({
  page,
}) => {
  const { phone } = await startShopper(page);
  await page.goto(`/${SHOP}/signin`);
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Text me a code" }).click();
  const right = await textedCode(phone);
  const wrong = right === "000000" ? "111111" : "000000";

  await code(page).fill(wrong);
  await expect(page.getByRole("status")).toHaveText("That code is not right. 4 tries left.");
  await expect(code(page)).toHaveAttribute("aria-invalid", "true");
  await expect(code(page)).toHaveValue("");
  for (const left of ["3 tries", "2 tries", "1 try"]) {
    await code(page).fill(wrong);
    await expect(page.getByRole("status")).toHaveText(`That code is not right. ${left} left.`);
  }
  await code(page).fill(wrong);
  await expect(page.getByRole("status")).toHaveText("Too many wrong codes. Ask for a new one.");
  await expect(code(page)).toBeDisabled();

  // A locked sign-in takes no more codes: starting again keeps the number, and the new code signs in.
  await page.getByRole("button", { name: "Start again" }).click();
  await expect(page.getByText("Too many wrong codes. Ask for a new one.")).toBeVisible();
  await expect(page.getByLabel("Phone number")).toHaveValue(phone);
  const before = await textsTo(phone);
  await page.getByRole("button", { name: "Text me a code" }).click();
  await code(page).fill(await textedCode(phone, before));
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/account$`));
});

test("resend waits out its countdown, and Change number goes back with the number kept", async ({
  page,
}) => {
  await page.clock.install();
  const { phone } = await startShopper(page);
  await page.goto(`/${SHOP}/signin`);
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Text me a code" }).click();
  await textedCode(phone);
  const resend = page.getByRole("button", { name: /Send again in 0:\d\d/ });
  await expect(resend).toBeDisabled();
  await page.clock.runFor(31_000);
  await expect(page.getByRole("button", { name: "Send a new code" })).toBeEnabled();

  await page.getByRole("button", { name: "Change number" }).click();
  await expect(page.getByLabel("Phone number")).toHaveValue(phone);
});

test("an invalid number is refused next to the field", async ({ page }) => {
  await startShopper(page);
  await page.goto(`/${SHOP}/signin`);
  await page.getByLabel("Phone number").fill("12345 6789");
  await page.getByRole("button", { name: "Text me a code" }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter a 10-digit phone number");
  await expect(page.getByLabel("Phone number")).toHaveAttribute("aria-invalid", "true");
});

test("an unknown shop and the bare site say what to do", async ({ page }) => {
  const response = await page.goto("/no-such-shop/signin");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We could not find that shop" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Open your shop's link" })).toBeVisible();
});

test("a browser with no session is sent from the account to sign in", async ({ page }) => {
  await startShopper(page);
  await page.goto(`/${SHOP}/account`);
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/signin$`));
});

test.describe("signed in", () => {
  test("signing in twice keeps one account", async ({ page }) => {
    const { phone } = await startShopper(page);
    await signIn(page, phone);
    await signIn(page, phone);
    await expect(page.getByRole("heading", { name: "Hi there" })).toBeVisible();
  });
});
