// Day 32 done-when: a customer places an unpaid order. A shopper fills a cart from a product page and a tile, sees
// the till's total, checks out for pickup by keyboard and lands on "Awaiting payment"; a second shopper racing for the
// last tin is told it has gone and finds the line flagged in the cart. Each run seeds its own tagged catalogue.
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

const cartButton = (page: Page) => page.getByRole("link", { name: /^Cart,/ });

/** Fills the checkout for pickup at the first open time and places the order. */
async function placeOrder(page: Page, phone: string) {
  await page.getByRole("radiogroup", { name: /^Time/ }).getByRole("radio").first().click();
  await page.getByLabel("Name").fill("Ama Mensah");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Place order" }).click();
}

test("a shopper fills a cart, checks out for pickup and the order awaits payment", async ({
  page,
}, info) => {
  const { phone } = await startShopper(page);
  const [osu] = store.branches;
  await page.goto(`/${SHOP}/products/${store.products.rice}?branch=${osu}`);
  await expect(page.getByRole("heading", { name: `Jasmine rice ${tag}` })).toBeVisible({
    timeout: 30_000,
  });
  // Server-rendered: the buttons work once the page hydrates.
  await expect(async () => {
    await page.getByRole("button", { name: `One more Jasmine rice ${tag}` }).click();
    await expect(
      page.getByRole("group", { name: `Quantity of Jasmine rice ${tag}` }),
    ).toContainText("2", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(cartButton(page)).toHaveAccessibleName("Cart, 1 item");

  await page.goto(`/${SHOP}?branch=${osu}&q=${tag}`);
  await page.getByRole("button", { name: `Add Frytol oil ${tag} to cart` }).click();
  await expect(cartButton(page)).toHaveAccessibleName("Cart, 2 items");
  await page.keyboard.press("c");
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/cart`));
  const items = page.getByRole("region", { name: "Items" });
  await expect(items.getByRole("listitem")).toHaveCount(2);
  // Two rice at GH₵ 12.00 and one oil at GH₵ 30.00: the till's prices.
  await expect(page.locator("aside")).toContainText("GH₵ 54.00");
  await expect(page.locator("aside")).toContainText("2 items");
  await expectNoSeriousAxe(page);
  await shoot(page, info, "shop-cart");

  await page.getByRole("link", { name: "Checkout" }).click();
  await expect(page.getByRole("heading", { name: "Checkout", level: 1 })).toBeVisible();
  await expect(
    page.getByRole("radio", { name: new RegExp(`Pick up at Osu ${tag}`) }),
  ).toBeChecked();
  // Placing with nothing filled in says what is missing and goes to it.
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByText("Choose a time")).toBeVisible();
  await expect(page.getByText("Enter your name")).toBeVisible();
  await shoot(page, info, "shop-checkout");
  await placeOrder(page, phone);

  await expect(page.getByRole("heading", { name: "Awaiting payment" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Pay before .* to keep your items/)).toBeVisible();
  await expect(page.locator("aside")).toContainText("GH₵ 54.00");
  await expect(page.getByText(`Pick up at Osu ${tag}`)).toBeVisible();
  await expect(cartButton(page)).toHaveAccessibleName("Cart, empty");
  await expectNoSeriousAxe(page);
  await shoot(page, info, "shop-order");
  // The address alone, without the checkout key, shows nothing.
  await page.goto(new URL(page.url()).pathname);
  await expect(page.getByText("We could not find that order")).toBeVisible();
});

test("the shopper who loses the race for the last tin is told, and the cart flags it", async ({
  browser,
}) => {
  const [osu] = store.branches;
  const shoppers = await Promise.all([browser.newPage(), browser.newPage()]);
  for (const page of shoppers) {
    await startShopper(page);
    await page.goto(`/${SHOP}/products/${store.products.milo}?branch=${osu}`);
    await expect(async () => {
      await page.getByRole("button", { name: "Add to cart" }).click();
      await expect(cartButton(page)).toHaveAccessibleName("Cart, 1 item", { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await page.goto(`/${SHOP}/checkout?branch=${osu}`);
    await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled({
      timeout: 30_000,
    });
  }
  const [first, second] = shoppers as [Page, Page];
  await placeOrder(first, "0241112222");
  await expect(first.getByRole("heading", { name: "Awaiting payment" })).toBeVisible({
    timeout: 30_000,
  });
  await placeOrder(second, "0243334444");
  await expect(second.getByRole("alert")).toContainText("no longer available");
  await second.getByRole("link", { name: "Review your cart" }).click();
  await expect(second.getByText(`Not available at Osu ${tag}`)).toBeVisible();
  await expect(
    second.getByRole("button", { name: "Fix the flagged items to check out" }),
  ).toBeDisabled();
  await Promise.all(shoppers.map((page) => page.close()));
});

test("a dropped connection on Place order says so, and trying again places the order once", async ({
  page,
}) => {
  const { phone } = await startShopper(page);
  const [osu] = store.branches;
  await page.goto(`/${SHOP}/products/${store.products.oil}?branch=${osu}`);
  await expect(async () => {
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(cartButton(page)).toHaveAccessibleName("Cart, 1 item", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.goto(`/${SHOP}/checkout?branch=${osu}`);
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled({ timeout: 30_000 });
  await page.route("**/api/shop/*/orders", (route) => route.abort("internetdisconnected"), {
    times: 1,
  });
  await placeOrder(page, phone);
  await expect(page.getByRole("alert")).toContainText("We could not reach the shop");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: "Awaiting payment" })).toBeVisible({
    timeout: 30_000,
  });
});
