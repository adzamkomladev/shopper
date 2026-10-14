import { expect, test } from "@playwright/test";

test("portal documents use Start and its own same-origin backend", async ({ page, request }) => {
  const response = await request.get("/login");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("<html");
  expect(html).toContain("<script");
  expect(html).not.toContain("/src/index.tsx");
  expect(html).toContain("$tsr");
  const lookup = await request.get("/api/orgs/e2e-mart");
  expect(lookup.ok()).toBe(true);
  expect(await lookup.json()).toMatchObject({ name: "E2E Mart" });
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(
    cookies.some((cookie) => cookie.name.endsWith("better-auth.session_token") && cookie.httpOnly),
  ).toBe(true);
});
