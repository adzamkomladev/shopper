// What owners receive from the store day: at closing the registers still without a Z, then the day's figures; and
// the store's hours, which the day wakes by, are set on the store.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createApi } from "@shopper/api";
import { deliverNotification } from "@shopper/core/notifications";
import { runStoreDay, storeDayId } from "@shopper/core/reports";
import { memoryWorkflow, type Envelope, type Workflow } from "@shopper/ports";
import { ids } from "../../../fixtures/sales/golden";
import { notifications, sentMessages } from "../../../support/stock/queue";
import { appVersion } from "../../../support/till/server/data";
import { dayWorld, recordingLauncher } from "../../../support/reports/day";

let w: Awaited<ReturnType<typeof dayWorld>>;
beforeAll(async () => {
  w = await dayWorld();
  await runStoreDay(memoryWorkflow(storeDayId(ids.org, ids.store, "2026-10-15")), deps(), {
    orgId: ids.org,
    storeId: ids.store,
    day: "2026-10-15",
  });
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

function deps(storeDays = recordingLauncher().launcher) {
  return {
    withDatabase: <T>(run: (db: typeof w.world.db) => Promise<T>) => run(w.world.db),
    appVersion,
    queue: notifications,
    storeDays,
  };
}
async function deliver(message: Envelope, mail = true) {
  const sent: { email: string; subject: string; plain: string; link: string }[] = [];
  const outcome: string[] = [];
  await deliverNotification(
    {
      db: w.world.db,
      appVersion,
      ...(mail
        ? {
            baseUrl: "https://portal.example/",
            mail: async (m: (typeof sent)[number]) => {
              sent.push(m);
              return "ref";
            },
          }
        : {}),
    } as Parameters<typeof deliverNotification>[0],
    {
      message,
      attempts: 1,
      ack: async () => void outcome.push("ack"),
      retry: async () => void outcome.push("retry"),
    },
  );
  return { sent, outcome };
}
const queued = async (type: string) => (await sentMessages()).find((m) => m.type === type)!;

test("the reminder names the register still without a Z and links to the shifts", async () => {
  const { sent, outcome } = await deliver(await queued("store-day.reminder"));
  expect(outcome).toEqual(["ack"]);
  expect(sent).toHaveLength(1);
  const [mail] = sent;
  expect(mail).toMatchObject({
    subject: expect.stringContaining("15 Oct 2026"),
    link: "https://portal.example/shifts",
  });
  const registers = ((await queued("store-day.reminder")).payload as { registers: string[] })
    .registers;
  expect(registers).toHaveLength(1);
  expect(mail!.plain).toContain(`- ${registers[0]}`);
  expect(mail!.email).toMatch(/@owner\.test$/);
});

test("the summary carries the day's figures against yesterday and links to that day's dashboard", async () => {
  const { sent, outcome } = await deliver(await queued("store-day.summary"));
  expect(outcome).toEqual(["ack"]);
  expect(sent[0]).toMatchObject({
    subject: expect.stringContaining("15 Oct 2026 in figures"),
    link: "https://portal.example/reports?day=2026-10-15",
  });
  expect(sent[0]!.plain).toContain("Net sales GH₵ 12.00 (GH₵ 12.00)");
  expect(sent[0]!.plain).toContain("Transactions 1 (1)");
  expect(sent[0]!.plain).toContain("MoMo: GH₵ 12.00");
});

test("without mail or a portal origin the message waits for a retry", async () => {
  for (const type of ["store-day.reminder", "store-day.summary"])
    expect((await deliver(await queued(type), false)).outcome).toEqual(["retry"]);
});

test("store hours are set on the store, closing after opening, and the next day wakes by them", async () => {
  const patch = (body: object) =>
    w.owner.api.request(`/stores/${ids.store}`, {
      method: "PATCH",
      headers: { cookie: w.owner.cookie!, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const saved = await patch({ opensAt: "08:30", closesAt: "20:00" });
  expect(saved.status).toBe(200);
  expect(await saved.json()).toMatchObject({ opensAt: "08:30:00", closesAt: "20:00:00" });
  expect((await patch({ closesAt: "08:00" })).status).toBe(400);
  expect((await patch({ opensAt: "20:00" })).status).toBe(400);
  expect((await patch({ opensAt: "7:00" })).status).toBe(400);
  expect((await patch({ opensAt: "24:00" })).status).toBe(400);

  const waits: [string, string][] = [];
  const flow: Pick<Workflow, "instanceId" | "step" | "sleepUntil"> = {
    instanceId: storeDayId(ids.org, ids.store, "2026-10-20"),
    step: (_name, _policy, run) => run(),
    sleepUntil: async (name, at) => void waits.push([name, at.toISOString()]),
  };
  await runStoreDay(flow, deps(), { orgId: ids.org, storeId: ids.store, day: "2026-10-20" });
  expect(waits.slice(0, 2)).toEqual([
    ["opening", "2026-10-20T08:30:00.000Z"],
    ["closing", "2026-10-20T20:00:00.000Z"],
  ]);
});

test("a new store's day starts at once, not at the night's watchdog", async () => {
  const days = recordingLauncher();
  const api = createApi({
    database: w.world.db,
    authentication: w.owner.auth,
    storeDays: days.launcher,
  });
  const created = await api.request("/stores", {
    method: "POST",
    headers: { cookie: w.owner.cookie!, "content-type": "application/json" },
    body: JSON.stringify({ name: "Kumasi", opensAt: "06:00", closesAt: "22:00" }),
  });
  expect(created.status).toBe(201);
  const body = (await created.json()) as { id: string; opensAt: string };
  expect(body.opensAt).toBe("06:00:00");
  const today = new Date().toISOString().slice(0, 10);
  expect(days.started).toEqual([
    {
      id: storeDayId(ids.org, body.id, today),
      params: { orgId: ids.org, storeId: body.id, day: today },
    },
  ]);
});
