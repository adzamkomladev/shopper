import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// ponytail: params travel inside the verifier, so raising N later still verifies old records.
const N = 16_384;
const KEY_BYTES = 32;

const derive = (password: string, salt: Buffer, n: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_BYTES, { N: n, r, p }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

/** `scrypt$N$r$p$salt$key` with a random salt; the params are stored so they can change later. */
export async function hashVerifier(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, 8, 1);
  return ["scrypt", N, 8, 1, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function checkVerifier(verifier: string, password: string) {
  const [, n, r, p, salt, key] = verifier.split("$");
  if (!key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await derive(
    password,
    Buffer.from(salt!, "base64"),
    Number(n),
    Number(r),
    Number(p),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
