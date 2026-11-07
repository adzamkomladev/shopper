// A box's licence is genuine, bound to its machine, and confirmed by a check-in at least every 60 days.
import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import {
  confirmLicence,
  generateKey,
  issueLicence,
  licenceStatus,
  signedRequest,
  verifySignedRequest,
} from "@shopper/core/licence";

const DAY = 86_400_000;
const issued = new Date("2026-11-01T08:00:00Z");
const at = (days: number) => new Date(issued.getTime() + days * DAY);

async function fixture() {
  const issuer = await generateKey();
  const box = await generateKey();
  const licence = await issueLicence(issuer.privateKey, {
    id: v7(),
    org: v7(),
    site: "Accra Mall",
    machine: "a".repeat(64),
    key: box.publicKey,
    terminals: 5,
    issuedAt: issued.toISOString(),
    maintenanceUntil: "2027-11-01",
  });
  return { issuer, box, licence };
}

test("the ladder: valid, then a warning from day 30, then locked from day 60 until a check-in", async () => {
  const f = await fixture();
  const status = (days: number, confirmation?: unknown) =>
    licenceStatus({
      issuer: f.issuer.publicKey,
      machine: f.licence.machine,
      licence: f.licence,
      confirmation,
      now: at(days),
    });
  expect(await status(29)).toMatchObject({ state: "valid", locksAt: at(60).toISOString() });
  expect(await status(30)).toMatchObject({ state: "grace", locksAt: at(60).toISOString() });
  expect(await status(60)).toMatchObject({ state: "locked", reason: "expired" });
  const confirmation = await confirmLicence(f.issuer.privateKey, f.licence.id, at(59));
  expect(await status(70, confirmation)).toMatchObject({
    state: "valid",
    checkedInAt: at(59).toISOString(),
    locksAt: at(119).toISOString(),
  });
  // Maintenance ended long ago: the licence is perpetual and never consults it.
  expect(
    await status(400, await confirmLicence(f.issuer.privateKey, f.licence.id, at(399))),
  ).toMatchObject({ state: "valid" });
});

test("a licence that is not genuine for this machine locks at once, naming why", async () => {
  const f = await fixture();
  const other = await generateKey();
  const status = (input: Partial<Parameters<typeof licenceStatus>[0]>) =>
    licenceStatus({
      issuer: f.issuer.publicKey,
      machine: f.licence.machine,
      licence: f.licence,
      now: at(1),
      ...input,
    });
  expect(await status({ licence: undefined })).toMatchObject({
    state: "locked",
    reason: "missing",
  });
  expect(await status({ licence: { format: "lic/0" } })).toMatchObject({ reason: "unreadable" });
  expect(await status({ licence: { ...f.licence, terminals: 50 } })).toMatchObject({
    reason: "forged",
  });
  expect(await status({ issuer: other.publicKey })).toMatchObject({ reason: "forged" });
  expect(await status({ machine: "b".repeat(64) })).toMatchObject({ reason: "machine" });
  // A confirmation for another licence, or signed by anyone but the issuer, does not count.
  const stranger = await confirmLicence(other.privateKey, f.licence.id, at(70));
  const elsewhere = await confirmLicence(f.issuer.privateKey, v7(), at(70));
  expect(await status({ now: at(71), confirmation: stranger })).toMatchObject({ state: "locked" });
  expect(await status({ now: at(71), confirmation: elsewhere })).toMatchObject({ state: "locked" });
});

test("a licence-signed request proves the box holds the licensed key, the body and the time", async () => {
  const f = await fixture();
  const url = "https://api.shopper.test/licence/confirmations";
  const sign = (body: string, now = at(1), key = f.box.privateKey) =>
    signedRequest({ key, licence: f.licence }, url, { method: "POST", body }, now);
  const verify = (request: Request, now = at(1)) =>
    verifySignedRequest(request, { issuer: f.issuer.publicKey, now });

  expect((await verify(await sign('{"a":1}')))?.id).toBe(f.licence.id);
  const changed = await sign('{"a":1}');
  expect(
    await verify(
      new Request(changed.url, { method: "POST", headers: changed.headers, body: '{"a":2}' }),
    ),
  ).toBeUndefined();
  expect(await verify(await sign("{}", at(1), (await generateKey()).privateKey))).toBeUndefined();
  expect(await verify(await sign("{}"), new Date(at(1).getTime() + 6 * 60_000))).toBeUndefined();
  expect(await verify(new Request(url, { method: "POST", body: "{}" }))).toBeUndefined();
});
