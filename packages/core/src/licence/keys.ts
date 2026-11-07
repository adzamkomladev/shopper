// Ed25519 through WebCrypto (Workers, Bun and Node): private keys travel as JWK text, public keys as base64url `x`.
const ED25519 = { name: "Ed25519" } as const;
const encoder = new TextEncoder();

/** A new key pair: `privateKey` is a JWK string to keep secret, `publicKey` the base64url public key. */
export async function generateKey() {
  const pair = (await crypto.subtle.generateKey(ED25519, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { privateKey: JSON.stringify(jwk), publicKey: jwk.x! };
}

/** The public half of a private JWK. */
export const publicKeyOf = (privateKey: string) => (JSON.parse(privateKey) as JsonWebKey).x!;

export async function sign(privateKey: string, message: string) {
  const key = await crypto.subtle.importKey("jwk", JSON.parse(privateKey), ED25519, false, [
    "sign",
  ]);
  return toBase64Url(
    new Uint8Array(await crypto.subtle.sign(ED25519, key, encoder.encode(message))),
  );
}

/** False for any malformed key or signature, never a throw: a bad signature is just not genuine. */
export async function verify(publicKey: string, message: string, signature: string) {
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "OKP", crv: "Ed25519", x: publicKey },
      ED25519,
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      ED25519,
      key,
      fromBase64Url(signature),
      encoder.encode(message),
    );
  } catch {
    return false;
  }
}

export const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
export const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
