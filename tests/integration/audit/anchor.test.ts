// The daily anchor: the one watchdog (23:59 UTC, Accra's midnight) starts a one-shot workflow per org per day
// (instance id `anchor-{orgId}-{day}`). It publishes the head of the org chain and of every register chain to
// audit_anchor and queues one email per owner; running the day again publishes and sends nothing more.
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { v7 } from "uuid";
import { auditAnchor, auditLog, deviceAudit, member, role, user } from "@shopper/db-pg";
import { tillAudit } from "@shopper/db-sqlite";
import { boxAuditAnchors, boxWatchdog } from "@shopper/adapters-box";
import { auditAnchorId, deliverAuditAnchor, runWatchdog, verifyStream } from "@shopper/core/audit";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ids } from "../../support/till/sales";
import { api, deviceId } from "../../support/till/server";
import { syncHeaders } from "../../support/till/requests";
import { notifications, sentMessages } from "../../support/stock/queue";
import { portalOwner } from "../../support/api/portal";
import { appVersion } from "../../support/till/server/data";

let world: Awaited<ReturnType<typeof goldenWorld>>;
const at = new Date("2026-10-25T23:59:00.000Z");

beforeAll(async () => {
  world = await goldenWorld();
  // Only an owner can make an owner: promote the registered admin the way the seed places members.
  const owner = await portalOwner(ids.org, ids.cashier);
  const [superadmin] = await world.db
    .select({ id: role.id })
    .from(role)
    .where(and(eq(role.orgId, ids.org), eq(role.protectedOwner, true)));
  await world.db
    .update(member)
    .set({ roleId: superadmin!.id })
    .where(and(eq(member.orgId, ids.org), eq(member.userId, owner.principal.userId)));
  const chain = await world.local.read((tx) =>
    tx.select().from(tillAudit).orderBy(asc(tillAudit.chainSeq)),
  );
  await api.request("/sync/audit", {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify({ requestId: v7(), entries: chain }),
  });
});
afterAll(async () => {
  await world?.local.close();
});

test("the watchdog anchors every stream once a day and queues one email per owner", async () => {
  const before = await heads();
  const anchors = boxAuditAnchors({ database: world.db, queue: notifications });
  await runWatchdog({ withDatabase: (run) => run(world.db), anchors: anchors.launcher }, at);
  await anchors.idle();
  const published = await world.db
    .select()
    .from(auditAnchor)
    .where(eq(auditAnchor.orgId, ids.org))
    .orderBy(asc(auditAnchor.stream));
  expect(published.map((a) => [a.day, a.stream, a.chainSeq, a.hash])).toEqual(
    [
      ["2026-10-25", "org", before.org.seq, before.org.hash],
      ["2026-10-25", deviceId, before.device.seq, before.device.hash],
    ].sort((a, b) => String(a[1]).localeCompare(String(b[1]))),
  );
  const [run] = await world.db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.orgId, ids.org), eq(auditLog.command, "audit.anchor")));
  expect(run).toMatchObject({ chainSeq: before.org.seq + 1 });
  const mails = (await sentMessages()).filter((m) => m.type === "audit.anchor");
  const recipients = await owners();
  expect(recipients.length).toBeGreaterThan(0);
  expect(mails.map((m) => m.payload)).toEqual(
    recipients.map((r) => ({ day: "2026-10-25", userId: r.id })),
  );

  // The same day again, from the cron or a restarted box: nothing more is published, audited or sent.
  await runWatchdog({ withDatabase: (run) => run(world.db), anchors: anchors.launcher }, at);
  const again = boxAuditAnchors({ database: world.db, queue: notifications });
  await again.launcher.start(auditAnchorId(ids.org, "2026-10-25"), {
    orgId: ids.org,
    day: "2026-10-25",
  });
  await again.idle();
  expect(
    await world.db.select().from(auditAnchor).where(eq(auditAnchor.orgId, ids.org)),
  ).toHaveLength(2);
  expect((await sentMessages()).filter((m) => m.type === "audit.anchor")).toHaveLength(
    recipients.length,
  );
  expect(await verifyStream(world.db, ids.org, "org")).toMatchObject({ valid: true });
  expect(await verifyStream(world.db, ids.org, deviceId)).toMatchObject({ valid: true });
});

test("the owner's email names each stream's head and links to the integrity page", async () => {
  const sent: { email: string; subject: string; plain: string; link: string }[] = [];
  const message = (await sentMessages()).find((m) => m.type === "audit.anchor")!;
  const recipient = (await owners()).find(
    (r) => r.id === (message.payload as { userId: string }).userId,
  )!;
  const outcome: string[] = [];
  await deliverAuditAnchor(
    {
      db: world.db,
      appVersion,
      baseUrl: "https://portal.example",
      mail: async (mail) => {
        sent.push(mail);
        return "ref";
      },
    },
    {
      message,
      attempts: 1,
      ack: async () => void outcome.push("ack"),
      retry: async () => void outcome.push("retry"),
    },
  );
  expect(outcome).toEqual(["ack"]);
  const anchors = await world.db.select().from(auditAnchor).where(eq(auditAnchor.orgId, ids.org));
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({
    email: recipient.email,
    subject: expect.stringContaining("25 Oct 2026"),
    link: "https://portal.example/audit/integrity",
  });
  for (const anchor of anchors) {
    expect(sent[0]!.plain).toContain(anchor.hash);
    expect(sent[0]!.plain).toContain(`#${anchor.chainSeq}`);
  }

  // Without mail credentials the message waits to be retried rather than being dropped.
  const without: string[] = [];
  await deliverAuditAnchor(
    { db: world.db, appVersion },
    {
      message,
      attempts: 1,
      ack: async () => void without.push("ack"),
      retry: async () => void without.push("retry"),
    },
  );
  expect(without).toEqual(["retry"]);
});

test("the box watchdog fires at 23:59 UTC each day, the cron Cloudflare runs", async () => {
  vi.useFakeTimers({ now: new Date("2026-10-25T12:00:00.000Z") });
  const fired: string[] = [];
  const watchdog = boxWatchdog(async (when) => void fired.push(when.toISOString()));
  await vi.advanceTimersByTimeAsync(11 * 3_600_000 + 58 * 60_000);
  expect(fired).toEqual([]);
  await vi.advanceTimersByTimeAsync(24 * 3_600_000 + 60_000);
  expect(fired).toEqual(["2026-10-25T23:59:00.000Z", "2026-10-26T23:59:00.000Z"]);
  watchdog.stop();
  vi.useRealTimers();
});

async function heads() {
  const [org] = await world.db
    .select({ seq: auditLog.chainSeq, hash: auditLog.hash })
    .from(auditLog)
    .where(and(eq(auditLog.orgId, ids.org), isNotNull(auditLog.chainSeq)))
    .orderBy(desc(auditLog.chainSeq))
    .limit(1);
  const [device] = await world.db
    .select({ seq: deviceAudit.chainSeq, hash: deviceAudit.hash })
    .from(deviceAudit)
    .where(eq(deviceAudit.streamId, deviceId))
    .orderBy(desc(deviceAudit.chainSeq))
    .limit(1);
  return { org: { seq: org!.seq!, hash: org!.hash! }, device: device! };
}

/** The org's owners: members holding the protected owner role. */
function owners() {
  return world.db
    .select({ id: user.id, email: user.email })
    .from(member)
    .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
    .innerJoin(user, and(eq(user.orgId, member.orgId), eq(user.id, member.userId)))
    .where(and(eq(member.orgId, ids.org), eq(role.protectedOwner, true)))
    .orderBy(asc(user.id));
}
