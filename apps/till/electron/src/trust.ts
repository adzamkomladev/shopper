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
export async function pinBoxCa(upstream: string, userData: string) {
  const url = new URL(upstream);
  if (url.protocol !== "https:" || !/\.local$|^[\d.]+$|^\[[\d:a-f]+\]$/i.test(url.hostname))
    return undefined;
  const pem = await download(new URL("/ca.crt", url));
  const certificate = new X509Certificate(pem);
  if (!certificate.ca) throw new Error(`${url.host}/ca.crt is not a CA certificate`);
  const path = join(userData, "box-ca.pem");
  await writeFile(path, certificate.toString());
  return path;
}

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
function download(url: URL) {
  return new Promise<string>((resolve, reject) => {
    const sent = request(url, { rejectUnauthorized: false, timeout: 10_000 }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`${url} answered ${response.statusCode}`));
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => (body += chunk));
      response.on("end", () => resolve(body));
    });
    sent.on("timeout", () => sent.destroy(new Error(`${url} timed out`)));
    sent.on("error", reject);
    sent.end();
  });
}
