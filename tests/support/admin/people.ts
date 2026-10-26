import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { BOX_API, MART, signInWithKeyboard, type Shop } from "../e2e";
import { post, shopHeaders, unique } from "../admin";
import { waitForPublicSlot } from "../publicauth/slots";

export type RoleRow = {
  id: string;
  name: string;
  protectedOwner: boolean;
  permissionCodes: string[];
};
export type UserRow = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  branchIds: string[];
  deactivatedAt: string | null;
};
export type Invitation = {
  id: string;
  email: string;
  setupLink?: string;
  status: string;
  deliveryStatus?: "pending" | "sent" | "failed";
};

export const STAFF_PASSWORD = "e2e-staff-password-123";

async function get<T>(request: APIRequestContext, path: string) {
  const response = await request.get(`${BOX_API}${path}`, {
    headers: await shopHeaders(request),
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as T;
}

/** Every permission code the shop knows, so a test can build "everything except one". */
export const allPermissionCodes = async (request: APIRequestContext) =>
  (await get<{ code: string }[]>(request, "/permissions")).map(({ code }) => code);

export const listRoles = (request: APIRequestContext) => get<RoleRow[]>(request, "/roles");
export const listUsers = (request: APIRequestContext) => get<UserRow[]>(request, "/users");
export const listInvitations = (request: APIRequestContext) =>
  get<Invitation[]>(request, "/invitations");

export async function roleNamed(request: APIRequestContext, name: string) {
  const found = (await listRoles(request)).find((role) => role.name === name);
  if (!found) throw new Error(`No role named ${name}`);
  return found;
}

/** Creates a custom role through the real API as the owner. */
export const createCustomRole = (
  request: APIRequestContext,
  name: string,
  permissionCodes: string[] = [],
) => post<RoleRow>(request, "/roles", { name, permissionCodes });

/** Issues a LAN setup link (no email involved) for a new member in `roleName`. */
export async function inviteLocal(request: APIRequestContext, email: string, roleName: string) {
  const role = await roleNamed(request, roleName);
  return post<Invitation>(request, "/invitations", { email, roleId: role.id, channel: "local" });
}

/** Opens a setup link the way the invitee would: preview with its token, then accept with a new password. */
export function linkParts(setupLink: string) {
  const url = new URL(setupLink);
  return { id: url.searchParams.get("id")!, token: url.searchParams.get("token")! };
}

export async function acceptSetupLink(request: APIRequestContext, setupLink: string, name: string) {
  const { id, token } = linkParts(setupLink);
  await waitForPublicSlot();
  const response = await request.post(`${BOX_API}/invitations/${id}/accept`, {
    headers: await shopHeaders(request),
    data: { token, name, password: STAFF_PASSWORD },
  });
  expect(response.status(), await response.text()).toBeLessThan(300);
}

export type Staff = { name: string; email: string; shop: Shop; userId: string };

/** A new member in `roleName`, created through the invitation flow, ready to sign in with STAFF_PASSWORD. */
export async function createStaff(request: APIRequestContext, roleName: string, label: string) {
  const tag = unique();
  const name = `${label} ${tag}`;
  const email = `${label.toLowerCase()}-${tag}@mart.e2e.example`;
  const invitation = await inviteLocal(request, email, roleName);
  await acceptSetupLink(request, invitation.setupLink!, name);
  const user = (await listUsers(request)).find((row) => row.email === email)!;
  return { name, email, shop: { ...MART, email }, userId: user.id } satisfies Staff;
}

export const signInAs = (page: Page, staff: Staff) =>
  signInWithKeyboard(page, staff.shop, STAFF_PASSWORD);

export const dialog = (page: Page) => page.getByRole("dialog");
export const row = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });

/** Picks an option in the open Select by typing its first letters, which is how a keyboard user does it. */
export async function chooseByTyping(
  page: Page,
  combobox: ReturnType<Page["getByRole"]>,
  text: string,
) {
  await combobox.focus();
  await page.keyboard.press("Enter");
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const focusedOption = listbox.locator('[role="option"][data-highlighted]');
  await expect(focusedOption).toBeVisible();
  await expect(focusedOption).toBeFocused();
  const prefix = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const intended = page.getByRole("option", { name: new RegExp(`^${prefix}`, "i") });
  await expect(intended).toBeVisible();
  await page.keyboard.type(text, { delay: 50 });
  await expect(intended).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(combobox).toContainText(new RegExp(`^${prefix}`, "i"));
}
