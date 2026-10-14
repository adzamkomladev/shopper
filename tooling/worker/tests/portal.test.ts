import { env } from "cloudflare:test";
import { expect, test } from "vitest";

const bindings = env as {
  PORTAL: Fetcher;
  PORTAL_NO_API: Fetcher;
};

test("portal forwards exact /api as the API root", async () => {
  const response = await bindings.PORTAL.fetch("https://shopper.test/api");

  expect(response.status).toBe(207);
  expect(await response.json()).toMatchObject({ pathname: "/", search: "" });
});

test("portal keeps the /api/auth path for Better Auth", async () => {
  const response = await bindings.PORTAL.fetch("https://shopper.test/api/auth/sign-in/email");

  expect(response.status).toBe(207);
  expect(await response.json()).toMatchObject({ pathname: "/api/auth/sign-in/email" });
});

test("portal strips /api from paths outside the auth subtree", async () => {
  const response = await bindings.PORTAL.fetch("https://shopper.test/api/authentic?mode=check");

  expect(response.status).toBe(207);
  expect(await response.json()).toMatchObject({ pathname: "/authentic", search: "?mode=check" });
});

test("portal strips /api and forwards request and response details", async () => {
  const body = JSON.stringify({ name: "Shop floor" });
  const response = await bindings.PORTAL.fetch(
    new Request("https://shopper.test/api/stores?cursor=next%2Fpage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://portal.staging.test",
        "X-Shopper-Org": "7d339e51-4d59-4bf9-b5af-6807606d8f88",
        Cookie: "session=owner; preference=compact",
      },
      body,
    }),
  );

  expect(response.status).toBe(207);
  expect(response.headers.get("set-cookie")).toContain("portal_session=forwarded");
  expect(await response.json()).toEqual({
    pathname: "/stores",
    search: "?cursor=next%2Fpage",
    method: "POST",
    body,
    origin: "https://portal.staging.test",
    org: "7d339e51-4d59-4bf9-b5af-6807606d8f88",
    cookie: "session=owner; preference=compact",
  });
});

test("portal serves non-API assets but never falls back to HTML when API is missing", async () => {
  const asset = await bindings.PORTAL.fetch("https://shopper.test/catalogue/imports");
  expect(asset.headers.get("content-type")).toContain("text/html");
  expect(await asset.text()).toContain("portal asset");
  const apiLookingAsset = await bindings.PORTAL.fetch("https://shopper.test/apiary");
  expect(apiLookingAsset.headers.get("content-type")).toContain("text/html");

  const missingApi = await bindings.PORTAL_NO_API.fetch("https://shopper.test/api/stores");
  expect(missingApi.status).toBe(503);
  expect(missingApi.headers.get("content-type")).not.toContain("text/html");
  expect(await missingApi.text()).not.toContain("portal asset");
});
