import * as v from "valibot";
import { webhookSchema, type PaystackWebhook } from "./schemas/base";

const encoder = new TextEncoder();

/**
 * Checks `x-paystack-signature` (HMAC-SHA512 hex of the raw body) and parses the event. HMAC lives
 * here, apart from the SHA-256 in @shopper/utils, because the two have different purposes.
 */
export async function verifyWebhook(
  secretKey: string,
  rawBody: string,
  signature: string | null | undefined,
): Promise<PaystackWebhook | undefined> {
  const provided = signature ? hexToBytes(signature) : undefined;
  if (!provided) return undefined;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["verify"],
  );
  // subtle.verify compares in constant time.
  if (!(await crypto.subtle.verify("HMAC", key, provided, encoder.encode(rawBody))))
    return undefined;
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return undefined;
  }
  const parsed = v.safeParse(webhookSchema, json);
  return parsed.success ? parsed.output : undefined;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | undefined {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) return undefined;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index++)
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}
