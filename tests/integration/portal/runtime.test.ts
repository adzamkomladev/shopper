import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import {
  authRequest,
  portalTenantSlug,
  startPortalFixture,
  stopPortalFixture,
} from "../../support/portal/runtime";

beforeAll(startPortalFixture);
afterAll(stopPortalFixture);

test("the portal runs API-prefixed business routes through the in-process runtime", async () => {
  const response = await authRequest(0, `/api/orgs/${portalTenantSlug(0)}`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    id: expect.any(String),
    name: "Portal tenant 0",
  });
});

test("auth paths retain Better Auth routing under the portal API prefix", async () => {
  const response = await authRequest(0, "/api/auth/get-session");
  expect(response.status).toBe(200);
  expect(await response.json()).toBeNull();
});
