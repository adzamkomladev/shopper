// The owner's side of business verification: a draft saved in parts, then submitted whole. Only members who may
// submit for the business see or change it, each write is audited, and one shop never sees another's case.
import { expect, test } from "vite-plus/test";
import { and, eq, like } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { auth, otherContext } from "../auth/setup";
import { call, caseRow, context, cookies, db, otherApi, validCase, waitForStatus } from "./support";

const audits = (command: string) =>
  db
    .select()
    .from(schema.auditLog)
    .where(and(eq(schema.auditLog.orgId, context.orgId), like(schema.auditLog.command, command)));

test("a draft saves in parts and reads back; submitting it incomplete names what is missing", async () => {
  const empty = await call("/kyb");
  expect(empty.status).toBe(200);
  expect(await empty.json()).toMatchObject({ status: "draft", version: 0, directors: [] });

  const saved = await call("/kyb", "PUT", { businessName: "Ama Mart Limited", tin: "C0012345678" });
  expect(saved.status).toBe(200);
  expect(await saved.json()).toMatchObject({
    status: "draft",
    businessName: "Ama Mart Limited",
    tin: "C0012345678",
  });
  expect(await audits("kyb.save")).toHaveLength(1);

  const incomplete = await call("/kyb/submit", "POST");
  expect(incomplete.status).toBe(400);
  expect(JSON.stringify(await incomplete.json())).toMatch(/settlement|director|document/i);
  expect((await caseRow())?.status).toBe("draft");
});

test("only members who may submit for the business can see or change it", async () => {
  for (const role of ["cashier", "accountant", "inventory"]) {
    expect((await call("/kyb", "GET", undefined, role)).status).toBe(403);
    expect((await call("/kyb", "PUT", { tin: "C0000000000" }, role)).status).toBe(403);
    expect((await call("/kyb/submit", "POST", undefined, role)).status).toBe(403);
  }
  expect((await call("/kyb", "GET", undefined, "admin")).status).toBe(200);
  expect((await call("/kyb", "PUT", { businessName: "x" }, undefined)).status).toBe(200);
});

test("a submitted case is audited and locked until it is decided; another shop sees none of it", async () => {
  expect((await call("/kyb", "PUT", await validCase())).status).toBe(200);
  const submitted = await call("/kyb/submit", "POST");
  expect(submitted.status).toBe(202);
  expect(await audits("kyb.submit")).toHaveLength(1);
  await waitForStatus("in_review");
  expect((await call("/kyb", "PUT", { tin: "C0000000001" })).status).toBe(409);

  const other = await otherApi.request("/kyb", { headers: { cookie: cookies.get("other")! } });
  expect(await other.json()).toMatchObject({ status: "draft", businessName: null });
  expect(await caseRow(otherContext.orgId)).toBeUndefined();
});

test("a runtime without business verification (the box) has no KYB routes", async () => {
  const box = createApi({ database: db, authentication: auth });
  expect((await box.request("/kyb")).status).toBe(404);
});
