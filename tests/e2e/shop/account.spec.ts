// A signed-in shopper's account: points, receipts and a receipt's page from replayed answers; details, addresses and
// signing out against the real API.
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../support/e2e";
import {
  busyReceipts,
  replayAccount,
  SHOP,
  signIn,
  startShopper,
} from "../../support/shop/browser";

const you = (page: Page) => page.getByRole("dialog", { name: "You" });

test("the account shows the points, the tier and every receipt newest first", async ({ page }) => {
  const { phone } = await startShopper(page);
  await replayAccount(page);
  await signIn(page, phone);
  const points = page.getByRole("region", { name: "Your points" });
  await expect(points).toContainText("1,240");
  await expect(points).toContainText("Gold");
  await expect(points).toContainText("+128 on Sat 31 Oct");
  const list = page.getByRole("region", { name: "Your receipts" }).getByRole("link");
  await expect(list).toHaveCount(4);
  await expect(list.first()).toContainText("GH₵ 128.45");
  await expect(list.first()).toContainText("Osu · OSU1-T01-000480");
  await expect(list.nth(2)).toContainText("East Legon");
  await expectNoSeriousAxe(page);
});

test("a receipt opens with the till's receipt and its PDF; one without a PDF says so", async ({
  page,
}) => {
  const { phone } = await startShopper(page);
  await replayAccount(page);
  await signIn(page, phone);
  await page.getByRole("link", { name: /OSU1-T01-000480/ }).click();
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/receipts/${busyReceipts[0]!.id}$`));
  await expect(page.getByRole("heading", { name: "GH₵ 128.45" })).toBeVisible();
  await expect(page.getByText("Fresh milk")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
    "href",
    `/api/shop/account/receipts/${busyReceipts[0]!.id}/pdf`,
  );
  await expectNoSeriousAxe(page);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/account$`));
  await page.getByRole("link", { name: /OSU1-T01-000481/ }).click();
  await expect(page.getByText("The PDF appears here once the till sends it.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveCount(0);
});

test("a receipt that is not theirs is a designed not-found page", async ({ page }) => {
  const { phone } = await startShopper(page);
  await signIn(page, phone);
  await page.goto(`/${SHOP}/receipts/01970000-0000-7000-8000-00000000dead`);
  await expect(page.getByRole("heading", { name: "We could not find that receipt" })).toBeVisible();
  await page.getByRole("button", { name: "Your receipts" }).click();
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/account$`));
});

test("with loyalty off there is no points card", async ({ page }) => {
  const { phone } = await startShopper(page);
  await replayAccount(page, { points: false });
  await signIn(page, phone);
  await expect(page.getByRole("region", { name: "Your receipts" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your points" })).toHaveCount(0);
});

test("You: the shopper saves a name, adds, edits and removes an address, then signs out", async ({
  page,
}) => {
  const { phone } = await startShopper(page);
  await signIn(page, phone);
  await page.keyboard.press("y");
  await expect(you(page)).toBeVisible();
  await you(page).getByLabel("Name").fill("Ama Mensah");
  await you(page).getByLabel("Email").fill("ama@example.com");
  await you(page).getByRole("button", { name: "Save details" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  // The open sheet hides the page from assistive tech; the greeting behind it already uses the new name.
  await expect(page.getByRole("heading", { name: "Hi, Ama", includeHidden: true })).toBeAttached();

  await you(page).getByRole("button", { name: "Add" }).click();
  const form = you(page).getByRole("form", { name: "New address" });
  await form.getByLabel("Name it").fill("Home");
  await form.getByLabel("Street or house").fill("12 Oxford Street");
  await form.getByLabel("Area").fill("Osu");
  await form.getByLabel("Town or city").fill("Accra");
  await form.getByRole("button", { name: "Add address" }).click();
  const home = you(page).getByRole("listitem").filter({ hasText: "Home" });
  await expect(home).toContainText("12 Oxford Street, Osu, Accra");
  await expect(home).toContainText("Default");
  await expectNoSeriousAxe(page);

  await home.getByRole("button", { name: "Edit Home" }).click();
  const edit = you(page).getByRole("form", { name: "Edit Home" });
  await edit.getByLabel("Town or city").fill("");
  await edit.getByRole("button", { name: "Save address" }).click();
  await expect(edit.getByRole("alert")).toHaveText("Enter the town or city");
  await edit.getByLabel("Town or city").fill("Tema");
  await edit.getByRole("button", { name: "Save address" }).click();
  await expect(you(page).getByRole("listitem").filter({ hasText: "Home" })).toContainText(
    "Osu, Tema",
  );

  await you(page).getByRole("button", { name: "Remove Home" }).click();
  await expect(you(page).getByText("Add where you want orders delivered.")).toBeVisible();

  await you(page).getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/signin$`));
  await page.goto(`/${SHOP}/account`);
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/signin$`));
});
