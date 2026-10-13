import { expect, test as setup, type APIRequestContext } from "@playwright/test";
import {
  ANNEX,
  BOOTSTRAP_TOKEN,
  BOX_API,
  BRANCH_NAME,
  MART,
  OWNER_NAME,
  OWNER_PASSWORD,
  PORTAL_ORIGIN,
  signInWithKeyboard,
  type Shop,
  waitForAuthSlot,
} from "../../support/e2e";

type Row = { id: string; name: string };

// Signs the owner up with the bootstrap token (sign-up starts a session), or in when a reused
// server already has them. Sign-in is limited to 3 per 10s per IP, so it is the fallback only.
async function ownerSession(request: APIRequestContext, shop: Shop, orgId: string) {
  const headers = { "X-Shopper-Org": orgId, Origin: PORTAL_ORIGIN };
  const credentials = { email: shop.email, password: OWNER_PASSWORD };
  await waitForAuthSlot();
  const signUp = await request.post(`${BOX_API}/api/auth/sign-up/email`, {
    headers: { ...headers, "X-Shopper-Bootstrap-Token": BOOTSTRAP_TOKEN },
    data: { ...credentials, name: OWNER_NAME },
  });
  if (!signUp.ok()) {
    await waitForAuthSlot();
    const signIn = await request.post(`${BOX_API}/api/auth/sign-in/email`, {
      headers,
      data: credentials,
    });
    expect(signIn.ok(), `sign-up ${signUp.status()}, sign-in ${signIn.status()}`).toBe(true);
  }
  return headers;
}

async function ensure(
  request: APIRequestContext,
  path: string,
  headers: Record<string, string>,
  data: { name: string; storeId?: string },
) {
  const listed = await request.get(`${BOX_API}${path}`, { headers });
  expect(listed.ok()).toBe(true);
  const found = ((await listed.json()) as Row[]).find((row) => row.name === data.name);
  if (found) return found;
  const created = await request.post(`${BOX_API}${path}`, { headers, data });
  expect(created.status(), await created.text()).toBe(201);
  return (await created.json()) as Row;
}

setup("sign up an owner per shop and create the Accra Central branch", async ({ request }) => {
  for (const shop of [MART, ANNEX]) {
    const lookup = await request.get(`${BOX_API}/orgs/${shop.code}`);
    expect(lookup.ok()).toBe(true);
    const { id } = (await lookup.json()) as Row;
    const headers = await ownerSession(request, shop, id);
    if (shop === MART) {
      const store = await ensure(request, "/stores", headers, { name: "Accra Store" });
      await ensure(request, "/branches", headers, { name: BRANCH_NAME, storeId: store.id });
    }
  }
});

setup("sign in to E2E Mart through the portal and save the session", async ({ page }) => {
  await signInWithKeyboard(page, MART);
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await page.context().storageState({
    path: process.env.E2E_STORAGE_STATE ?? "tests/e2e/.auth/owner.json",
  });
});
