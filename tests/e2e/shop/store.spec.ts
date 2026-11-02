// The public store of E2E Mart on the real shop host: browsing, search by keyboard, categories, the branch selector
// hiding what a branch has run out of, a product page's metadata and structured data, the sitemap, each page of a
// listing indexed under its own address, and the designed dead ends (an unknown product, category or shop). Each run
// seeds its own branches and products, tagged so earlier runs never match.
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../support/e2e";
import { SHOP } from "../../support/shop/browser";
import { e2eStore } from "../../support/shop/catalogue";
import { shoot } from "../../support/customers/shots";

// Screenshots and axe at five sizes take a while on a busy runner.
test.describe.configure({ timeout: 180_000 });

const tag = Date.now().toString(36);
let store: Awaited<ReturnType<typeof e2eStore>>;
test.beforeAll(async () => {
  store = await e2eStore(tag);
});

const tile = (page: import("@playwright/test").Page, name: string) =>
  page.getByRole("region", { name: "Products" }).getByRole("link", { name: new RegExp(name) });

test("a shopper searches by keyboard and switching branch hides what that branch has run out of", async ({
  page,
}, info) => {
  const [osu, kaneshie] = store.branches;
  await page.goto(`/${SHOP}?branch=${osu}`);
  await expect(page).toHaveTitle(/Shop online/, { timeout: 30_000 });
  const search = page.getByRole("searchbox", { name: "Search the store" });
  // The page is server-rendered; its keys work once it hydrates.
  await expect(async () => {
    await page.keyboard.press("/");
    await expect(search).toBeFocused({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await search.fill(tag);
  await search.press("Enter");
  await expect(page).toHaveURL(new RegExp(`q=${tag}`));
  await expect(tile(page, `Jasmine rice ${tag}`)).toContainText("GH₵ 12.00");
  await expect(tile(page, `Frytol oil ${tag}`)).toContainText("GH₵ 30.00");
  await expect(tile(page, `Staff biscuits ${tag}`)).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, info, "store-search");

  await page.getByRole("combobox", { name: "Branch" }).click();
  await page.getByRole("option", { name: `Kaneshie ${tag}` }).click();
  await expect(page).toHaveURL(new RegExp(`branch=${kaneshie}`));
  await expect(tile(page, `Jasmine rice ${tag}`)).toHaveCount(0);
  // The till at Kaneshie charges its own price for the oil.
  await expect(tile(page, `Frytol oil ${tag}`)).toContainText("GH₵ 28.00");
  await expect(page.getByText(new RegExp(`products? at Kaneshie ${tag}`))).toBeVisible();
});

test("a category has its own page and a product page is indexable with its price", async ({
  page,
}, info) => {
  const [osu, kaneshie] = store.branches;
  await page.goto(`/${SHOP}?branch=${osu}`);
  await page
    .getByRole("navigation", { name: "Categories" })
    .getByRole("link", { name: store.category.name })
    .click();
  await expect(page).toHaveURL(new RegExp(`/${SHOP}/categories/${store.category.id}`), {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { name: store.category.name, level: 1 })).toBeVisible();
  await expect(tile(page, `Jasmine rice ${tag}`)).toBeVisible();

  await tile(page, `Jasmine rice ${tag}`).click();
  await expect(page.getByRole("heading", { name: `Jasmine rice ${tag}`, level: 1 })).toBeVisible();
  await expect(page.getByText(`In stock at Osu ${tag}`)).toBeVisible();
  await expect(page).toHaveTitle(`Jasmine rice ${tag} · E2E Mart`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`/${SHOP}/products/${store.products.rice}$`),
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent())!,
  );
  expect(data).toMatchObject({
    "@type": "Product",
    name: `Jasmine rice ${tag}`,
    offers: { priceCurrency: "GHS", price: "12.00", availability: "https://schema.org/InStock" },
  });
  await expectNoSeriousAxe(page);
  await shoot(page, info, "store-product");

  // At a branch without it the page still answers, says so and keeps itself out of the index.
  await page.goto(`/${SHOP}/products/${store.products.rice}?branch=${kaneshie}`);
  await expect(page.getByText(`Not available at Kaneshie ${tag}`)).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/${SHOP}\\?branch=${kaneshie}`));
});

test("the sitemap lists the products the store shows, never a hidden one", async ({ request }) => {
  const sitemap = await request.get(`/${SHOP}/sitemap.xml`);
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("application/xml");
  const xml = await sitemap.text();
  expect(xml).toContain(`/${SHOP}/products/${store.products.rice}</loc>`);
  expect(xml).toContain(`/${SHOP}/categories/${store.category.id}</loc>`);
  expect(xml).not.toContain(store.products.hidden);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /*/account");
});

test("an empty search, an unknown product and an unknown shop each say what to do next", async ({
  page,
}, info) => {
  await page.goto(`/${SHOP}?q=zzzz${tag}`);
  await expect(page.getByRole("heading", { name: `Nothing matches “zzzz${tag}”` })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Clear the search" }).click();
  await expect(page).not.toHaveURL(/q=/);
  await shoot(page, info, "store-home");
  // Every page of a listing past the first is indexed under its own address.
  await page.goto(`/${SHOP}?page=2`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`/${SHOP}\\?page=2$`),
  );

  await page.goto(`/${SHOP}/products/${store.products.hidden}`);
  await expect(
    page.getByRole("heading", { name: "That product is not in the store" }),
  ).toBeVisible();
  await page.goto(`/${SHOP}/categories/not-a-category`);
  await expect(page.getByRole("heading", { name: "That category is not here" })).toBeVisible();
  await page.goto(`/no-such-shop-${tag}`);
  await expect(page.getByRole("heading", { name: "We could not find that shop" })).toBeVisible();
});
