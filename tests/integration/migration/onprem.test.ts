// Day 43: an owner moves a cloud shop onto its own box. Starting the move seals an archive and freezes the cloud org
// (members' changes and registers' uploads refused, no new receipt numbers handed out), the cloud issues the box's
// licence from the request code it shows, and calling the move off lets the shop trade in the cloud again.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { buildInfo } from "@shopper/config";
import { licence as licenceSchema, publicKeyOf, verify } from "@shopper/core/licence";
import * as v from "valibot";
import { handshake, tillCall } from "../../support/migration/move";
import { boxIdentity, cloudAndBox } from "../../support/migration/onprem";

let h: Awaited<ReturnType<typeof cloudAndBox>>;
beforeAll(async () => {
  h = await cloudAndBox();
}, 300_000);
afterAll(async () => h?.close());

const push = () =>
  tillCall(
    h.cloud,
    h.registers[0]!,
    h.registers[0]!.token,
  )("/sync/push", {
    requestId: v7(),
    protocol: buildInfo.syncProtocol,
    receiptLastUsed: 0,
    events: [],
    proofs: [],
  });
const category = () => h.member("owner", "POST", "/categories", { name: "Grains" });

test("only an owner with migration.run starts the move, and nothing is frozen before", async () => {
  expect((await h.member("cashier", "POST", "/migration/onprem")).status).toBe(403);
  expect((await h.member("owner", "GET", "/migration/onprem")).status).toBe(200);
  expect(await (await h.member("owner", "GET", "/migration/onprem")).json()).toMatchObject({
    move: null,
  });
  expect((await push()).status).not.toBe(423);
  const before = await handshake(tillCall(h.cloud, h.registers[0]!, h.registers[0]!.token), 0);
  expect(before.body).toHaveProperty("receipts");
});

test("starting the move seals an archive and freezes the cloud org", async () => {
  const started = await h.member("owner", "POST", "/migration/onprem");
  expect(started.status).toBe(202);
  await h.sealed();
  const read = (await (await h.member("owner", "GET", "/migration/onprem")).json()) as {
    move: { status: string; archive: string; exportJobId: string };
    registers: { id: string }[];
  };
  expect(read.move).toMatchObject({ status: "open", archive: "ready" });
  // Every register of the shop, the fixture's own and the two trading here.
  expect(read.registers.map((r) => r.id)).toEqual(
    expect.arrayContaining(h.registers.map((r) => r.id)),
  );
  // The sealed archive downloads like any other.
  const download = await h.member(
    "owner",
    "GET",
    `/export/archives/${read.move.exportJobId}/download`,
  );
  expect(download.status).toBe(200);
  // A second start is told the move is on.
  expect((await h.member("owner", "POST", "/migration/onprem")).status).toBe(409);

  expect((await category()).status).toBe(423);
  expect((await push()).status).toBe(423);
  // Every member's banner says why.
  expect(await (await h.member("cashier", "GET", "/billing/status")).json()).toMatchObject({
    onPrem: "open",
  });
  // Reads still work, and the handshake hands out no new numbers: the box would not know them.
  expect((await h.member("owner", "GET", "/categories")).status).toBe(200);
  const frozen = await handshake(tillCall(h.cloud, h.registers[0]!, h.registers[0]!.token), 0);
  expect(frozen.status).toBe(200);
  expect(frozen.body).not.toHaveProperty("receipts");
  expect(frozen.body).not.toHaveProperty("relocation");
});

test("the cloud issues the box's licence from its request code, for this shop only", async () => {
  const box = await boxIdentity();
  expect(
    (await h.member("owner", "POST", "/migration/onprem/licence", { request: "not a code" }))
      .status,
  ).toBe(422);
  expect(
    (await h.member("cashier", "POST", "/migration/onprem/licence", { request: box.request }))
      .status,
  ).toBe(403);
  const issued = await h.member("owner", "POST", "/migration/onprem/licence", {
    request: box.request,
  });
  expect(issued.status).toBe(201);
  const licence = v.parse(licenceSchema, await issued.json());
  expect(licence).toMatchObject({
    org: h.f.ctx.orgId,
    site: "Kofi Mart",
    machine: box.machine,
    key: box.key.publicKey,
    terminals: 5,
  });
  // Genuine: signed by the issuer every box trusts.
  const { signature, ...unsigned } = licence;
  expect(
    await verify(
      publicKeyOf(h.issuer.privateKey),
      JSON.stringify([
        unsigned.format,
        unsigned.id,
        unsigned.org,
        unsigned.site,
        unsigned.machine,
        unsigned.key,
        unsigned.terminals,
        unsigned.issuedAt,
        unsigned.maintenanceUntil,
      ]),
      signature,
    ),
  ).toBe(true);
  const read = (await (await h.member("owner", "GET", "/migration/onprem")).json()) as {
    move: { licence: { id: string } };
  };
  expect(read.move.licence.id).toBe(licence.id);
});

test("calling the move off lets the shop trade in the cloud again", async () => {
  expect((await h.member("cashier", "DELETE", "/migration/onprem")).status).toBe(403);
  expect((await h.member("owner", "DELETE", "/migration/onprem")).status).toBe(200);
  expect(await (await h.member("owner", "GET", "/migration/onprem")).json()).toMatchObject({
    move: { status: "cancelled" },
  });
  expect((await category()).status).toBe(201);
  expect((await push()).status).not.toBe(423);
  expect(await (await h.member("cashier", "GET", "/billing/status")).json()).toMatchObject({
    onPrem: null,
  });
  const open = await handshake(tillCall(h.cloud, h.registers[0]!, h.registers[0]!.token), 0);
  expect(open.body).toHaveProperty("receipts");
  // A cancelled move has nothing to cancel, and a new one can start.
  expect((await h.member("owner", "DELETE", "/migration/onprem")).status).toBe(409);
  expect((await h.member("owner", "POST", "/migration/onprem")).status).toBe(202);
  await h.sealed();
});
