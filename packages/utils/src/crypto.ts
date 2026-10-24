export async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const hmacKey = (secret: string, usage: "sign" | "verify") =>
  crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );

/** Every signed link (auth, statements) is keyed by one shared secret that must be at least 32 characters. */
export function assertLinkSecret(secret: string) {
  if (secret.length < 32) throw new Error("Link secret must be at least 32 characters");
}

/** HMAC-SHA-256 of `message` under `secret`, as lowercase hex. */
export async function hmacHex(secret: string, message: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** Whether `hex` is the HMAC of `message`; the comparison is constant time. */
export async function hmacVerify(secret: string, message: string, hex: string): Promise<boolean> {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return false;
  const signature = Uint8Array.from(hex.match(/../g)!, (pair) => Number.parseInt(pair, 16));
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    signature,
    new TextEncoder().encode(message),
  );
}
