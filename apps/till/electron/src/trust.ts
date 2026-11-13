import { X509Certificate } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { request } from "node:https";
import { join } from "node:path";

/**
 * A till enrolling with a box on the shop's LAN (`https://shopper.local`, or an address) pins the box's own root CA
 * (Caddy's internal CA, served at `/ca.crt`) and returns its path; the host is then started with
 * `NODE_EXTRA_CA_CERTS` set to it. Trust on first use on the LAN: the enrolment code still proves the server.
 * A cloud upstream (a public name) uses the public CAs and pins nothing.
 */
export async function pinBoxCa(upstream: string, userData: string, timeout = 10_000) {
  const url = new URL(upstream);
  if (url.protocol !== "https:" || !onLan(url.hostname)) return undefined;
  const pem = await download(new URL("/ca.crt", url), timeout);
  const certificate = new X509Certificate(pem);
  if (!certificate.ca) throw new Error(`${url.host}/ca.crt is not a CA certificate`);
  const path = join(userData, "box-ca.pem");
  await writeFile(path, certificate.toString());
  return path;
}

/**
 * First run: a box on this LAN that hands over its CA within 3 s is the server (Avahi names it shopper.local);
 * otherwise the build's upstream, the cloud. A box that is down or not a box costs the wait and nothing else.
 */
export async function findServer(box: string | undefined, fallback: string, userData: string) {
  const ca = box && (await pinBoxCa(box, userData, 3_000).catch(() => undefined));
  if (box && ca) return { upstream: box, ca };
  const pinned = await pinBoxCa(fallback, userData);
  return pinned ? { upstream: fallback, ca: pinned } : { upstream: fallback };
}

/**
 * The address a cashier types on the enrol screen when mDNS is blocked (`192.168.1.20`, `shopper.local`, with or
 * without `https://`): it must be a box on the LAN, and it must hand over its CA, which is pinned.
 */
export async function changeServer(address: string, userData: string) {
  const typed = address
    .trim()
    .replace(/^https:\/\//i, "")
    .replace(/\/$/, "");
  const url = URL.canParse(`https://${typed}`) ? new URL(`https://${typed}`) : undefined;
  if (!url || url.pathname !== "/" || !onLan(url.hostname))
    throw new Error("Type the box's address, like 192.168.1.20 or shopper.local");
  const ca = await pinBoxCa(url.origin, userData, 3_000).catch((error: NodeJS.ErrnoException) => {
    // A socket error (ECONNREFUSED, EHOSTUNREACH…) or the timeout: nothing there. Anything else answered wrongly.
    const unreachable = error.name === "AbortError" || /^E[A-Z]+$/.test(error.code ?? "");
    throw new Error(
      unreachable
        ? `Nothing answered at ${url.host}. Check the box is on and on this network.`
        : `${url.host} is not a Shopper box`,
    );
  });
  return { upstream: url.origin, ca };
}

/** A box is reached by its `.local` name or an address; a public name is the cloud. */
const onLan = (hostname: string) => /\.local$|^[\d.]+$|^\[[\d:a-f]+\]$/i.test(hostname);

/**
 * Whether a TLS chain (leaf first, PEM) is the box's: each certificate signed by the next (a CA), the last by the
 * pinned CA, all in date, and the leaf naming `host`. Electron's own network stack (the updater) does not read
 * `NODE_EXTRA_CA_CERTS`, so its session asks this.
 */
export function trustsPinned(chain: string[], host: string, pinnedPem: string) {
  const pinned = new X509Certificate(pinnedPem);
  const certificates = chain.map((pem) => new X509Certificate(pem));
  const now = Date.now();
  const leaf = certificates[0];
  if (!leaf || !(/^[\d.]+$/.test(host) ? leaf.checkIP(host) : leaf.checkHost(host))) return false;
  const path =
    certificates.at(-1)?.fingerprint256 === pinned.fingerprint256
      ? certificates
      : [...certificates, pinned];
  return path.every(
    (certificate, index) =>
      Date.parse(certificate.validFrom) <= now &&
      now <= Date.parse(certificate.validTo) &&
      // Only a CA signs: a leaf's key (CA:FALSE) never issues certificates, whatever it chains to.
      (index === 0 || certificate.ca) &&
      (path[index + 1] ?? pinned).ca &&
      certificate.checkIssued(path[index + 1] ?? pinned) &&
      certificate.verify((path[index + 1] ?? pinned).publicKey),
  );
}

type Presented = { data: string; issuerCert?: Presented };
/** A chain as Electron presents it (each certificate with its issuer), leaf first, as PEM. */
export const chainOf = (cert?: Presented): string[] =>
  cert ? [cert.data, ...(cert.issuerCert?.data === cert.data ? [] : chainOf(cert.issuerCert))] : [];

/** The only unverified TLS request the till makes: the certificate it is about to pin. */
function download(url: URL, timeout: number) {
  return new Promise<string>((resolve, reject) => {
    const sent = request(
      url,
      { rejectUnauthorized: false, signal: AbortSignal.timeout(timeout) },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          return reject(new Error(`${url} answered ${response.statusCode}`));
        }
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => (body += chunk));
        response.on("end", () => resolve(body));
      },
    );
    sent.on("error", reject);
    sent.end();
  });
}
