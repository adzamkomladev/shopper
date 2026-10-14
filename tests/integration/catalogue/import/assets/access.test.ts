import { expect, test } from "vite-plus/test";
import { call, api, cookies } from "../../support";

test("direct upload grants require product.write", async () => {
  const denied = await call(
    "/catalogue/imports/uploads",
    "POST",
    {
      fileName: "catalogue.csv",
      contentType: "text/csv",
      sizeBytes: 20,
    },
    "cashier",
  );
  expect(denied.status).toBe(403);
});

test("an unconfigured object store refuses upload grants explicitly", async () => {
  const result = await call("/catalogue/imports/uploads", "POST", {
    fileName: "catalogue.csv",
    contentType: "text/csv",
    sizeBytes: 20,
  });
  expect(result.status).toBe(503);
});

test("catalogue API rejects multipart bytes instead of accepting a file", async () => {
  const body = new FormData();
  body.set("file", new File(["SKU,Name\nA,Product"], "catalogue.csv"));
  const result = await api.request("/catalogue/imports?dryRun=1", {
    method: "POST",
    headers: { cookie: cookies.get("superadmin")! },
    body,
  });
  expect(result.status).toBe(415);
});

test("upload issuance accepts only small JSON metadata requests", async () => {
  const response = await call("/catalogue/imports/uploads", "POST", { padding: "x".repeat(5000) });
  expect(response.status).toBe(413);
});
