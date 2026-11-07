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
