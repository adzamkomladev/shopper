import { expect, test } from "@playwright/test";

test("portal documents are one static SPA shell with host info from a server function", async ({
  page,
  request,
}) => {
  const shells = new Set<string>();
  for (const path of ["/login", "/products", "/no/such/page"]) {
    const response = await request.get(path, { headers: { accept: "text/html" } });
    expect(response.ok()).toBe(true);
    const html = await response.text();
    expect(html).toContain("<script");
    expect(html).not.toContain("/src/index.tsx");
    expect(html).toContain("$tsr");
    shells.add(html);
  }
  expect(shells.size).toBe(1);
  const lookup = await request.get("/api/orgs/e2e-mart");
  expect(lookup.ok()).toBe(true);
  expect(await lookup.json()).toMatchObject({ name: "E2E Mart" });
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(page.locator('meta[name="shopper-version"]')).toHaveAttribute(
    "content",
    /^\d+\.\d+\.\d+/,
  );
  await expect(page.locator('meta[name="shopper-environment"]')).toHaveAttribute("content", "e2e");
  const cookies = await page.context().cookies();
  expect(
    cookies.some((cookie) => cookie.name.endsWith("better-auth.session_token") && cookie.httpOnly),
  ).toBe(true);
});
