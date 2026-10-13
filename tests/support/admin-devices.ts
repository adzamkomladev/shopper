import { expect, type APIRequestContext } from "@playwright/test";
import { BOX_API } from "./e2e";
import { shopHeaders } from "./admin";

export type DeviceRow = { id: string; name: string; branchName: string; status: string };

async function get<T>(request: APIRequestContext, path: string) {
  const response = await request.get(`${BOX_API}${path}`, { headers: await shopHeaders(request) });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as T;
}

export const listDevices = (request: APIRequestContext) => get<DeviceRow[]>(request, "/devices");

export async function branchIdNamed(request: APIRequestContext, name: string) {
  const found = (await get<{ id: string; name: string }[]>(request, "/branches")).find(
    (branch) => branch.name === name,
  );
  if (!found) throw new Error(`No branch named ${name}`);
  return found.id;
}

/** Redeems an enrolment code the way a till does, so a test can prove the code the portal showed is real. */
export async function redeemCode(request: APIRequestContext, code: string, name: string) {
  const headers = await shopHeaders(request);
  return request.post(`${BOX_API}/devices/enroll`, {
    headers,
    data: { orgId: headers["X-Shopper-Org"], code, name },
  });
}

/** A cashier signs in on a till with the PIN, which only works once the portal has saved it. */
export async function cashierLogin(
  request: APIRequestContext,
  till: { deviceId: string; deviceToken: string },
  userId: string,
  pin: string,
) {
  return request.post(`${BOX_API}/cashiers/login`, {
    headers: await shopHeaders(request),
    data: { deviceId: till.deviceId, deviceToken: till.deviceToken, userId, pin },
  });
}
