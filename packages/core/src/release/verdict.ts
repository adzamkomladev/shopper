import { compareVersions } from "@shopper/utils";
import type { Manifest } from "./schemas/base";
import type { UpdateVerdict } from "./types";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Whether a box may take a signed bundle. A licence is perpetual; `maintenanceUntil` only decides which updates it may
 * install, by the day each was built. Tax rule packs are always accepted: a rate change must never wait on a renewal.
 */
export function updateVerdict(input: {
  manifest: Pick<Manifest, "kind" | "version" | "builtAt" | "schemaVersion">;
  installed: { version: string; schemaVersion: number };
  /** The licence's `maintenanceUntil` (yyyy-mm-dd), or undefined when the box has no genuine licence. */
  maintenanceUntil: string | undefined;
}): UpdateVerdict {
  const { manifest, installed } = input;
  if (manifest.kind === "taxpack") return { ok: true };
  if (manifest.kind !== "update")
    return {
      ok: false,
      reason: "kind",
      message: "A full installer cannot update a box that is running.",
    };
  const order = compareVersions(manifest.version, installed.version);
  if (order === 0)
    return { ok: false, reason: "current", message: `This box already runs ${installed.version}.` };
  if (order < 0 || manifest.schemaVersion < installed.schemaVersion)
    return {
      ok: false,
      reason: "older",
      message: `${manifest.version} is older than ${installed.version}, which this box runs.`,
    };
  if (!input.maintenanceUntil)
    return {
      ok: false,
      reason: "licence",
      message: "This box has no genuine licence, so it cannot tell whether this update is covered.",
    };
  if (manifest.builtAt.slice(0, 10) > input.maintenanceUntil)
    return {
      ok: false,
      reason: "maintenance",
      message: `This update was built on ${day(manifest.builtAt)}, after your updates ended on ${day(input.maintenanceUntil)}. Renew support to install it.`,
    };
  return { ok: true };
}
