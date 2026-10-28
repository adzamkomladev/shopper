// A reviewer works the KYB queue: cases by status, each with its documents behind short-lived links, decided once.
// Two reviewers deciding at the same time get one winner and a conflict, and the decision is audited in both the
// shop's chain and the platform's, with the reviewer as the platform chain's actor.
import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import {
  asStaff,
  call,
  caseRow,
  context,
  db,
  platformContext,
  staff,
  validCase,
  waitForStatus,
} from "./support";
import { baseURL, otherAuth } from "../auth/setup";

test("the queue lists submitted cases by status, with signed document links", async () => {
  expect((await call("/kyb", "PUT", await validCase())).status).toBe(200);
  expect((await call("/kyb/submit", "POST")).status).toBe(202);
  await waitForStatus("in_review");

  const queue = await (await asStaff("/platform/kyb?status=in_review")).json();
  expect(queue).toEqual([
    expect.objectContaining({ orgId: context.orgId, status: "in_review", version: 1 }),
  ]);
  expect(await (await asStaff("/platform/kyb?status=checks_failed")).json()).toEqual([]);

  const detail = await (await asStaff(`/platform/kyb/${context.orgId}`)).json();
  expect(detail).toMatchObject({ orgId: context.orgId, businessName: "Ama Mart Limited" });
  expect(detail.documents).toHaveLength(2);
  // Each link is a short-lived grant straight from object storage: following it returns the scan.
  for (const document of [...detail.documents, ...detail.directors]) {
    const scan = await fetch(document.link);
    expect(scan.status).toBe(200);
    expect(await scan.text()).toMatch(/^scan /);
  }
});

test("two reviewers deciding at once get one winner; both chains record it", async () => {
  const version = (await caseRow())!.version;
  const [approve, reject] = await Promise.all([
    asStaff(`/platform/kyb/${context.orgId}/decision`, "POST", { version, decision: "approved" }),
    asStaff(`/platform/kyb/${context.orgId}/decision`, "POST", {
      version,
      decision: "rejected",
      note: "Blurred scan",
    }),
  ]);
  expect([approve.status, reject.status].sort((a, b) => a - b)).toEqual([200, 409]);
  await waitForStatus(approve.status === 200 ? "approved" : "rejected");

  const reviewerId = (await otherAuth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: staff.get("reviewer")! } }),
  ))!.userId;
  const [tenantRow] = await db
    .select()
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.orgId, context.orgId), eq(schema.auditLog.command, "kyb.decide")),
    );
  expect(tenantRow?.payload).toMatchObject({ reviewerId });
  const [platformRow] = await db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, platformContext.orgId),
        eq(schema.auditLog.command, "platform.kyb.decide"),
      ),
    );
  expect(platformRow).toMatchObject({ actorId: reviewerId, entityId: context.orgId });
});

test("the tenants list shows each shop's onboarding and verification, not the platform org", async () => {
  const tenants = (await (await asStaff("/platform/tenants")).json()) as { id: string }[];
  expect(tenants.map((tenant) => tenant.id)).toContain(context.orgId);
  expect(tenants.map((tenant) => tenant.id)).not.toContain(platformContext.orgId);
  expect(tenants.find((tenant) => tenant.id === context.orgId)).toMatchObject({
    kybStatus: expect.stringMatching(/approved|rejected/),
  });
});

test("a scan that is no longer tracked shows no link, and the case still opens", async () => {
  const kase = (await caseRow())!;
  const gone = v7();
  await db
    .update(schema.kybCase)
    .set({ documents: [{ ...kase.documents[0]!, assetId: gone }, ...kase.documents.slice(1)] })
    .where(eq(schema.kybCase.orgId, context.orgId));
  const response = await asStaff(`/platform/kyb/${context.orgId}`);
  expect(response.status).toBe(200);
  const detail = await response.json();
  expect(detail.documents[0]).toMatchObject({ assetId: gone, link: null });
  expect(detail.documents[1].link).toMatch(/^https?:\/\//);
});
