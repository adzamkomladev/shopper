// Members, branches and registers for the access suites, on top of the shared auth tenant.
import { expect } from "vite-plus/test";
import { createDeviceService } from "@shopper/auth/devices";
import { api, auth, baseURL, context, cookies, db, deviceCache, password, request } from "../setup";

export const devices = () =>
  createDeviceService(db, deviceCache.cache, context.appVersion, context.orgId);

export async function principalOf(who: string) {
  const found = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get(who)! } }),
  );
  if (!found) throw new Error(`${who} has no principal`);
  return found;
}

/** The member row behind a seeded role's user, as /users lists it. */
export async function userOf(who: string) {
  const users = (await (await request(api, cookies.get("superadmin")!, "/users")).json()) as {
    id: string;
    email: string;
    deactivatedAt: string | null;
    branchIds: string[];
  }[];
  const found = users.find((row) => row.email === `${who}@example.com`);
  if (!found) throw new Error(`No user ${who}`);
  return found;
}

/** A store with the named branches, created by the owner through the API. */
export async function branches(...names: string[]) {
  const owner = cookies.get("superadmin")!;
  const store = await (
    await request(api, owner, "/stores", "POST", { name: `Store ${names.join(" ")}` })
  ).json();
  const ids: string[] = [];
  for (const name of names) {
    const created = await request(api, owner, "/branches", "POST", { name, storeId: store.id });
    expect(created.status).toBe(201);
    ids.push((await created.json()).id);
  }
  return ids;
}

/** A register enrolled at `branchId`, plus PIN and password logins on it for a seeded member. */
export async function register(branchId: string) {
  const service = devices();
  const owner = await principalOf("superadmin");
  const issued = await service.issueEnrollment(owner, { branchId });
  const till = await service.enroll({ orgId: context.orgId, code: issued.code, name: "Register" });
  return {
    ...till,
    async pinLogin(who: string, pin = "1357") {
      const { id } = await userOf(who);
      await service.assignPin(owner, { userId: id, pin });
      return service.login({
        deviceId: till.deviceId,
        deviceToken: till.deviceToken,
        userId: id,
        pin,
      });
    },
    passwordLogin: (who: string) =>
      service.login({
        deviceId: till.deviceId,
        deviceToken: till.deviceToken,
        email: `${who}@example.com`,
        password,
      }),
  };
}
