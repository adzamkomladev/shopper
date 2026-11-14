import { v7 } from "uuid";
import { boxArchiveImport, boxCache } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import { createDeviceService } from "@shopper/auth/devices";
import {
  generateKey,
  issueLicence,
  signedRequest,
  type Licence,
  type Relocation,
} from "@shopper/core/licence";
import { signManifest } from "@shopper/export";
import { SECRETS } from "../export/org";
import { emptyDatabase, movedArchive } from "./archive";

/** The cloud's API root as a box calls it; the host strips `/api` before the API sees a request. */
export const CLOUD = "https://cloud.shopper.test/api";

/**
 * A box's shop moved into an empty cloud database the way the box does it: licence-signed open, every file, commit
 * with the credentials, and the import workflow run to ready. Returns the relocations the commit handed out and a cloud
 * API with the device routes, as a relocating till reaches it.
 */
export async function movedIn(seed?: Parameters<typeof movedArchive>[0]) {
  const a = await movedArchive(seed);
  const b = await emptyDatabase();
  const issuer = await generateKey();
  const key = await generateKey();
  const box = {
    key: key.privateKey,
    licence: (await issueLicence(issuer.privateKey, {
      id: v7(),
      org: a.context.orgId,
      site: "Accra Mall",
      machine: "a".repeat(64),
      key: key.publicKey,
      terminals: 5,
      issuedAt: new Date().toISOString(),
      maintenanceUntil: "2027-11-14",
    })) as Licence,
  };
  const imports = boxArchiveImport({ database: b.db, blobs: b.blobs });
  const cache = boxCache(":memory:");
  const api = createApi({
    database: b.db,
    blobs: b.blobs,
    licenceSigningKey: issuer.privateKey,
    archiveImports: imports.launcher,
    devices: createDeviceService(b.db, cache.cache, a.context.appVersion),
  });
  const call = async (path: string, method: string, body?: string | Uint8Array) => {
    const signed = await signedRequest(box, `${CLOUD}${path}`, { method, body });
    return api.fetch(new Request(signed.url.replace("/api/", "/"), signed));
  };
  const signed = await signManifest(a.manifest, a.key.privateKey);
  const opened = (await (
    await call(
      "/migration/imports",
      "POST",
      JSON.stringify({
        manifest: new TextDecoder().decode(signed.json),
        signature: signed.signature,
      }),
    )
  ).json()) as { id: string; missing: string[] };
  for (const path of opened.missing)
    await call(`/migration/imports/${opened.id}/files/${path}`, "PUT", (await a.read(path))!);
  const committed = await call(
    `/migration/imports/${opened.id}/commit`,
    "POST",
    JSON.stringify({
      credentials: {
        passwords: [{ userId: a.f.userId, password: SECRETS.password }],
        pins: [{ userId: a.f.userId, pinHash: SECRETS.pin }],
        sessionKey: SECRETS.sessionKey,
      },
    }),
  );
  const { relocations } = (await committed.json()) as { relocations: Relocation[] };
  await imports.launcher.idle?.();
  return {
    a,
    b,
    issuer,
    box,
    api,
    call,
    importId: opened.id,
    relocations,
    close: async () => {
      cache.close();
      await a.close();
      await b.close();
    },
  };
}
