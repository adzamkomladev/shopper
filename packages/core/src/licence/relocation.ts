import * as v from "valibot";
import { sign, verify } from "./keys";
import { relocation as relocationSchema, type Relocation } from "./schemas/base";

/**
 * `reloc/1`: the cloud's word that this register now belongs at `upstream`, with a one-time code to claim it. Signed by
 * the issuer's key, which every till build trusts, so a box can hand it over but cannot forge or redirect it.
 */
export async function signRelocation(
  issuerKey: string,
  fields: Omit<Relocation, "format" | "signature">,
): Promise<Relocation> {
  const unsigned = { format: "reloc/1" as const, ...fields };
  return { ...unsigned, signature: await sign(issuerKey, relocationMessage(unsigned)) };
}

/** The relocation when it is genuine, for this register, and not expired; otherwise undefined. */
export async function verifyRelocation(
  issuer: string,
  value: unknown,
  register: { orgId: string; deviceId: string },
  now = new Date(),
) {
  const parsed = v.safeParse(relocationSchema, value);
  if (!parsed.success) return undefined;
  const relocation = parsed.output;
  if (relocation.orgId !== register.orgId || relocation.deviceId !== register.deviceId) return;
  if (Date.parse(relocation.expiresAt) <= now.getTime()) return;
  return (await verify(issuer, relocationMessage(relocation), relocation.signature))
    ? relocation
    : undefined;
}

const relocationMessage = (relocation: Omit<Relocation, "signature">) =>
  JSON.stringify([
    relocation.format,
    relocation.orgId,
    relocation.deviceId,
    relocation.upstream,
    relocation.code,
    relocation.expiresAt,
  ]);
