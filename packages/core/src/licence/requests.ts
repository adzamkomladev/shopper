import * as v from "valibot";
import { sha256 } from "@shopper/utils";
import { fromBase64Url, sign, toBase64Url, verify } from "./keys";
import { licenceMessage } from "./licence";
import { licence as licenceSchema, type Licence } from "./schemas/base";

/** How old a signed request may be when it arrives. */
const FRESH_MS = 5 * 60_000;

/**
 * A request only this licensed box can make: it carries the licence and an Ed25519 signature, by the key the licence
 * names, over the method, path, time and body. The v1.5 relay uses the same identity.
 */
export async function signedRequest(
  identity: { key: string; licence: Licence },
  url: string,
  // A file (bytes) is signed by its SHA-256 like any JSON body, so a box can upload what it cannot send as text.
  init: { method: string; body?: string | Uint8Array },
  now = new Date(),
) {
  const body = init.body ?? "";
  const signedAt = now.toISOString();
  const target = new URL(url);
  return new Request(url, {
    method: init.method,
    body: init.body as BodyInit | undefined,
    headers: {
      "content-type":
        typeof init.body === "object" ? "application/octet-stream" : "application/json",
      "shopper-licence": toBase64Url(new TextEncoder().encode(JSON.stringify(identity.licence))),
      "shopper-signed-at": signedAt,
      "shopper-path": target.pathname + target.search,
      "shopper-signature": await sign(
        identity.key,
        await requestMessage(init.method, target.pathname + target.search, signedAt, body),
      ),
    },
  });
}

/** The licence behind a signed request, or undefined when anything about it is not genuine or not fresh. */
export async function verifySignedRequest(
  request: Request,
  options: { issuer: string; now?: Date },
) {
  const header = request.headers.get("shopper-licence");
  const signedAt = request.headers.get("shopper-signed-at");
  const signature = request.headers.get("shopper-signature");
  if (!header || !signedAt || !signature) return undefined;
  const age = (options.now ?? new Date()).getTime() - Date.parse(signedAt);
  if (!(Math.abs(age) <= FRESH_MS)) return undefined;
  const parsed = v.safeParse(licenceSchema, parseJson(header));
  if (!parsed.success) return undefined;
  const licence = parsed.output;
  if (!(await verify(options.issuer, licenceMessage(licence), licence.signature))) return undefined;
  // The signer's path: a host serving its API under a prefix (`/api`) strips it, so only that prefix may differ.
  const url = new URL(request.url);
  const path = request.headers.get("shopper-path") ?? url.pathname + url.search;
  if (!path.endsWith(url.pathname + url.search)) return undefined;
  const message = await requestMessage(
    request.method,
    path,
    signedAt,
    new Uint8Array(await request.clone().arrayBuffer()),
  );
  return (await verify(licence.key, message, signature)) ? licence : undefined;
}

const requestMessage = async (
  method: string,
  path: string,
  signedAt: string,
  body: string | Uint8Array,
) => JSON.stringify([method.toUpperCase(), path, signedAt, await sha256(body)]);

function parseJson(base64: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(base64)));
  } catch {
    return undefined;
  }
}
