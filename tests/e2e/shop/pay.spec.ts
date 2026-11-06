// Day 33 done-when: money arrives and the order is invoiced. A shopper places an order, pays by mobile money (the
// prompt approves at once) or by card (Paystack's page, then back to the order), and the order reads Paid with its
// receipt number; a declined prompt says so and lets them try another way. Paystack is a fake in the shop server.
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../support/e2e";
import { SHOP, startShopper } from "../../support/shop/browser";
import { e2eStore } from "../../support/shop/catalogue";
import { shoot } from "../../support/customers/shots";

test.describe.configure({ timeout: 180_000 });

const tag = Date.now().toString(36);
let store: Awaited<ReturnType<typeof e2eStore>>;
test.beforeAll(async () => {
  store = await e2eStore(tag, { checkout: true });
});

/** One oil (GH₵ 30.00) in the cart, checked out for pickup, and the placed order's page open. */
async function placedOrder(page: Page) {
  const { phone } = await startShopper(page);
  const [osu] = store.branches;
  await page.goto(`/${SHOP}/products/${store.products.oil}?branch=${osu}`);
  await expect(async () => {
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByRole("link", { name: /^Cart,/ })).toHaveAccessibleName("Cart, 1 item", {
      timeout: 1_000,
    });
  }).toPass({ timeout: 30_000 });
  await page.goto(`/${SHOP}/checkout?branch=${osu}`);
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("radiogroup", { name: /^Time/ }).getByRole("radio").first().click();
  await page.getByLabel("Name").fill("Ama Mensah");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByLabel("Email (optional)").fill("ama@example.com");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: "Awaiting payment" })).toBeVisible({
    timeout: 30_000,
  });
}

test("a shopper pays by mobile money and the order is paid and receipted", async ({
  page,
}, info) => {
  await placedOrder(page);
  await expect(page.getByRole("heading", { name: "Pay GH₵ 30.00" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "shop-pay");
  // Empty and wrong numbers are refused before anything is sent.
  await page.getByRole("button", { name: "Pay GH₵ 30.00" }).click();
  await expect(page.getByText("Enter a Ghana number like 024 123 4567")).toBeVisible();
  await page.getByLabel("Mobile money number").fill("055 123 4987");
  await page.getByRole("button", { name: "Pay GH₵ 30.00" }).click();
  await expect(page.getByRole("heading", { name: "Paid", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Receipt .*-W-\d{6}/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Pay / })).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, info, "shop-paid");
});

test("a shopper pays by card on Paystack's page and returns to a paid order", async ({
  page,
}, info) => {
  await placedOrder(page);
  const orderPage = page.url();
  await page.route("https://checkout.paystack.test/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Paystack</h1>" }),
  );
  // By keyboard: from the first way to pay, arrow to Card and press Enter.
  await page.getByRole("radio", { name: "Mobile money" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: "Card" })).toBeChecked();
  await page.keyboard.press("Enter");
  await page.waitForURL(/checkout\.paystack\.test\/.+/);
  const reference = new URL(page.url()).pathname.slice(1);
  const paid = await page.request.post(`/test/paystack/pay?reference=${reference}&pesewas=3000`);
  expect(paid.ok()).toBe(true);
  await page.goto(orderPage);
  await expect(page.getByRole("heading", { name: "Paid", exact: true })).toBeVisible({
    timeout: 30_000,
  });
});

test("a declined mobile money prompt says so and the shopper can try again", async ({
  page,
}, info) => {
  await placedOrder(page);
  await page.getByLabel("Mobile money number").fill("055 123 0000");
  await page.getByRole("button", { name: "Pay GH₵ 30.00" }).click();
  await expect(page.getByRole("alert")).toContainText("You have not been charged", {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: "Awaiting payment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pay GH₵ 30.00" })).toBeEnabled();
  await shoot(page, info, "shop-pay-declined");
  await page.getByLabel("Mobile money number").fill("055 123 4987");
  await page.getByRole("button", { name: "Pay GH₵ 30.00" }).click();
  await expect(page.getByRole("heading", { name: "Paid", exact: true })).toBeVisible({
    timeout: 30_000,
  });
});
