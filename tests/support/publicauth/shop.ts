import { expect, type APIRequest, type APIRequestContext } from "@playwright/test";
import { OWNER_PASSWORD, waitForAuthSlot } from "../e2e";
import { emailedLink } from "./mail";
import { waitForPublicSlot } from "./slots";
import { e2eRun } from "../../../tooling/e2e/run";

export const PUBLIC_ORIGIN = e2eRun.url(5185);
const API = `${PUBLIC_ORIGIN}/api`;
const headers = { Origin: PUBLIC_ORIGIN };

/** A short id that is new on every run, so shop codes and emails never collide on a reused database. */
export const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export type NewShop = { id: string; code: string; name: string; email: string };

/** Registers, verifies and completes a shop through the public API, then signs the owner in on `request`. */
export async function createShopViaApi(request: APIRequestContext): Promise<NewShop> {
  const tag = unique();
  const data = {
    name: "Ama Owner",
    email: `owner-${tag}@shop.example.com`,
    shopName: `Ama Mart ${tag}`,
    shopCode: `ama-${tag}`,
  };
  await waitForPublicSlot(3);
  const started = await request.post(`${API}/onboarding/start`, { headers, data });
  expect(started.status(), await started.text()).toBe(201);
  const link = await emailedLink(request, data.email);
  const credentials = { id: link.searchParams.get("id"), token: link.searchParams.get("token") };
  const verified = await request.post(`${API}/onboarding/verify`, { headers, data: credentials });
  expect(verified.ok(), await verified.text()).toBe(true);
  const completed = await request.post(`${API}/onboarding/complete`, {
    headers,
    data: { ...credentials, password: OWNER_PASSWORD },
  });
  expect(completed.ok(), await completed.text()).toBe(true);
  const { orgId } = (await completed.json()) as { orgId: string };
  await waitForAuthSlot();
  const signedIn = await request.post(`${API}/auth/sign-in/email`, {
    headers: { ...headers, "X-Shopper-Org": orgId },
    data: { email: data.email, password: OWNER_PASSWORD },
  });
  expect(signedIn.ok(), await signedIn.text()).toBe(true);
  return { id: orgId, code: data.shopCode, name: data.shopName, email: data.email };
}

export async function roleId(request: APIRequestContext, shop: NewShop, name: string) {
  const response = await request.get(`${API}/roles`, {
    headers: { ...headers, "X-Shopper-Org": shop.id },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const role = ((await response.json()) as { id: string; name: string }[]).find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  );
  expect(role, `a ${name} role`).toBeDefined();
  return role!.id;
}

type Invitation = { id: string; setupLink?: string };

export async function invite(
  request: APIRequestContext,
  shop: NewShop,
  data: { email: string; roleId: string; channel: "email" | "local" },
) {
  const response = await request.post(`${API}/invitations`, {
    headers: { ...headers, "X-Shopper-Org": shop.id },
    data,
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as Invitation;
}

export async function invitationAction(
  request: APIRequestContext,
  shop: NewShop,
  id: string,
  action: "reissue" | "cancel",
) {
  const response = await request.post(`${API}/invitations/${id}/${action}`, {
    headers: { ...headers, "X-Shopper-Org": shop.id },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as Invitation;
}

/** An independent authenticated owner context for invitation suites; test requests stay signed out. */
export async function createInvitationFixture(request: APIRequest) {
  const owner = await request.newContext();
  try {
    const shop = await createShopViaApi(owner);
    return {
      owner,
      shop,
      cashierRole: await roleId(owner, shop, "cashier"),
      adminRole: await roleId(owner, shop, "admin"),
    };
  } catch (error) {
    await owner.dispose();
    throw error;
  }
}
