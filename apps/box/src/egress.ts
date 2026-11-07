/** The internet hosts the box's own code calls: Paystack, Hubtel (two), Arkesel and Maileroo. */
const PROVIDERS = [
  "api.paystack.co",
  "rmp.hubtel.com",
  "api-txnstatus.hubtel.com",
  "sms.arkesel.com",
  "smtp.maileroo.com",
];
/** Configured endpoints whose hosts are allowed too: the GRA SDC, the licence server, provider overrides, storage. */
const CONFIGURED = [
  "SHOPPER_SDC_URL",
  "SHOPPER_LICENCE_URL",
  "PAYSTACK_BASE_URL",
  "ARKESEL_BASE_URL",
  "MAILEROO_ENDPOINT",
  "SHOPPER_S3_ENDPOINT",
  "RIVET_ENDPOINT",
];

export class EgressRefusedError extends Error {
  constructor(host: string) {
    super(`The box does not call ${host}: add it to SHOPPER_EGRESS_ALLOW if it is needed`);
  }
}

/**
 * `fetch` limited to the hosts the box uses, plus `SHOPPER_EGRESS_ALLOW` (comma separated). Loopback, private LAN
 * addresses and `.local` names always pass: the box serves its own shop. The installer's firewall is the OS copy.
 */
export function egressFetch(
  environment: Record<string, string | undefined>,
  inner: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
) {
  const allowed = new Set([
    ...PROVIDERS,
    ...CONFIGURED.flatMap((name) =>
      environment[name] ? [new URL(environment[name]).hostname] : [],
    ),
    ...(environment.SHOPPER_EGRESS_ALLOW ?? "")
      .split(",")
      .map((host) => host.trim())
      .filter(Boolean),
  ]);
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const host = new URL(input instanceof Request ? input.url : String(input)).hostname;
    if (!allowed.has(host) && !local(host)) {
      console.error({ event: "egress.refused", host });
      throw new EgressRefusedError(host);
    }
    return inner(input, init);
  };
}

function local(host: string) {
  if (host === "localhost" || host === "[::1]" || host.endsWith(".local")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = octets as [number, number];
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}
