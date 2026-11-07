// Day 34: the shopper's order page as the store fills the order: the progress, what was changed, the review form and the
// shop's reviews on its page. Busy answers are replayed for the order; the shop itself is the real one.
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../support/e2e";
import { shoot } from "../../support/customers/shots";
import { ORDER_ID, shopperOrder } from "../../support/orders/busy";
import { SHOP, startShopper } from "../../support/shop/browser";

test.describe.configure({ timeout: 180_000 });
const KEY = "2f6f1f0e-0d2a-4b7a-9c43-0d9d7a3f1e11";

const serve = (
  page: Page,
  order: () => unknown,
  onPost?: (url: string, body: unknown) => unknown,
) =>
  page.route(
    (url) => url.pathname.startsWith(`/api/shop/${SHOP}/orders/${ORDER_ID}`),
    (route) => {
      const request = route.request();
      if (request.method() === "POST" && onPost)
        return route.fulfill({ status: 201, json: onPost(request.url(), request.postDataJSON()) });
      return route.fulfill({ json: order() });
    },
  );
const open = async (page: Page) => {
  await startShopper(page);
  await page.goto(`/${SHOP}/orders/${ORDER_ID}?t=${KEY}`);
};

test("a ready order shows its progress and what the shop changed", async ({ page }, info) => {
  await serve(page, () => shopperOrder("ready"));
  await open(page);
  await expect(page.getByRole("heading", { name: "Ready for pickup" })).toBeVisible();
  const progress = page.getByRole("region", { name: "Progress" });
  await expect(progress.getByRole("listitem")).toHaveCount(5);
  await expect(
    progress.getByRole("listitem").filter({ hasText: "Ready for pickup" }),
  ).toHaveAttribute("aria-current", "step");
  const changes = page.getByRole("region", { name: "Your order changed" });
  await expect(changes).toContainText("Palm oil 1L");
  await expect(changes).toContainText("GH₵ 10.00 is on its way back to you");
  await expectNoSeriousAxe(page);
  await shoot(page, info, "shop-fulfil-ready");
});

test("a delivery order says it is on its way and then delivered", async ({ page }, info) => {
  let status = "out_for_delivery";
  await serve(page, () =>
    shopperOrder(status, {
      fulfilment: "delivery",
      deliveryAddress: { line1: "12 Ring Road", area: "Osu", city: "Accra" },
    }),
  );
  await open(page);
  await expect(page.getByRole("heading", { name: "On its way" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Progress" })).toContainText("Out for delivery");
  status = "completed";
  await page.reload();
  await expect(page.getByRole("heading", { name: "Delivered" })).toBeVisible();
  await shoot(page, info, "shop-fulfil-delivered");
});

test("a collected order asks for a review by keyboard and thanks the shopper", async ({
  page,
}, info) => {
  let review: unknown = null;
  const sent: unknown[] = [];
  await serve(
    page,
    () => shopperOrder("completed", { review, canReview: !review }),
    (_url, body) => {
      sent.push(body);
      review = { rating: 4, comment: "Quick", status: "published" };
      return { reviewed: true };
    },
  );
  await open(page);
  await expect(page.getByRole("heading", { name: "Collected" })).toBeVisible();
  const stars = page.getByRole("radiogroup", { name: "Rating" });
  await expect(stars).toBeVisible();
  await expect(page.getByRole("button", { name: "Send review" })).toBeDisabled();
  await shoot(page, info, "shop-fulfil-review");
  await expect(async () => {
    await stars.getByRole("radio", { name: "4 stars" }).focus();
    await page.keyboard.press("4");
    await expect(stars.getByRole("radio", { name: "4 stars" })).toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByLabel("Your review").fill("Quick");
  await page.getByRole("button", { name: "Send review" }).click();
  await expect(page.getByRole("heading", { name: "Thank you for your review" })).toBeVisible();
  expect(sent).toEqual([{ key: KEY, rating: 4, comment: "Quick" }]);
});

test("the link from the review text opens the order in a fresh browser and sends the review with it", async ({
  page,
}, info) => {
  const link = `eyJvcmdJZCI6IngifQ.${"ab".repeat(32)}`;
  const seen: string[] = [];
  const sent: unknown[] = [];
  await serve(
    page,
    () => shopperOrder("completed", { review: null, canReview: true }),
    (_url, body) => {
      sent.push(body);
      return { reviewed: true };
    },
  );
  page.on("request", (request) => {
    if (request.url().includes(`/orders/${ORDER_ID}?`)) seen.push(request.url());
  });
  await startShopper(page);
  await page.goto(`/${SHOP}/orders/${ORDER_ID}?r=${link}`);
  await expect(page.getByRole("heading", { name: "Collected" })).toBeVisible();
  expect(seen.some((url) => url.includes(`r=${link}`) && !url.includes("t="))).toBe(true);
  const stars = page.getByRole("radiogroup", { name: "Rating" });
  await expect(async () => {
    await stars.getByRole("radio", { name: "5 stars" }).focus();
    await page.keyboard.press("5");
    await expect(stars.getByRole("radio", { name: "5 stars" })).toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Send review" }).click();
  await expect.poll(() => sent).toEqual([{ r: link, rating: 5, comment: "" }]);
  await shoot(page, info, "shop-review-link");
});

test("an unpaid order can be cancelled and then reads as cancelled", async ({ page }) => {
  let status = "placed";
  await serve(
    page,
    () =>
      shopperOrder(status, {
        timeline: [{ status: "placed", at: new Date().toISOString() }],
        adjustment: null,
        holdExpiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
        paidAt: null,
        receiptNumber: null,
      }),
    () => {
      status = "cancelled";
      return shopperOrder("cancelled", { timeline: [], adjustment: null });
    },
  );
  await open(page);
  await expect(page.getByRole("heading", { name: "Awaiting payment" })).toBeVisible();
  await expect(async () => {
    await page.getByRole("button", { name: "Cancel this order" }).click();
    await expect(page.getByRole("heading", { name: "Cancelled" })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
});

test("the store page shows the shop's average and its latest reviews once there are some", async ({
  page,
}, info) => {
  await page.route(
    (url) => url.pathname === `/api/shop/${SHOP}/reviews`,
    (route) =>
      route.fulfill({
        json: {
          count: 12,
          average: 4.6,
          latest: [
            {
              rating: 5,
              comment: "Quick and friendly",
              authorName: "Ama",
              at: "2026-11-05T10:00:00Z",
            },
            { rating: 4, comment: null, authorName: "Kofi", at: "2026-11-04T10:00:00Z" },
          ],
        },
      }),
  );
  await startShopper(page);
  await page.goto(`/${SHOP}`);
  const reviews = page.getByRole("region", { name: "What shoppers say" });
  await expect(reviews).toContainText("4.6");
  await expect(reviews).toContainText("from 12 reviews");
  await expect(reviews).toContainText("Quick and friendly");
  await shoot(page, info, "shop-reviews");
});
