// The box reaches the internet only at the hosts it is configured to use; the shop's own LAN is always open.
import { expect, test } from "vite-plus/test";
import { EgressRefusedError, egressFetch } from "@shopper/box";

function guarded(environment: Record<string, string | undefined> = {}) {
  const reached: string[] = [];
  const fetch = egressFetch(environment, async (input) => {
    reached.push(new URL(input instanceof Request ? input.url : String(input)).host);
    return new Response("ok");
  });
  return { fetch, reached };
}

test("an unknown internet host is refused before any request leaves the box", async () => {
  const box = guarded();
  await expect(box.fetch("https://collector.example/beacon")).rejects.toBeInstanceOf(
    EgressRefusedError,
  );
  await expect(box.fetch(new Request("https://8.8.8.8/"))).rejects.toThrow(/8\.8\.8\.8/);
  expect(box.reached).toEqual([]);
});

test("the providers, the configured services and the LAN pass", async () => {
  const box = guarded({
    SHOPPER_SDC_URL: "https://sdc.gra.gov.gh/api",
    SHOPPER_LICENCE_URL: "https://shopper-api.temtem.dev",
    SHOPPER_EGRESS_ALLOW: "status.example.com, backup.example.net",
  });
  for (const url of [
    "https://api.paystack.co/transaction/verify/x",
    "https://rmp.hubtel.com/merchantaccount",
    "https://api-txnstatus.hubtel.com/transactions",
    "https://sms.arkesel.com/api/v2/sms/send",
    "https://smtp.maileroo.com/send",
    "https://sdc.gra.gov.gh/api/invoices",
    "https://shopper-api.temtem.dev/licence/confirmations",
    "https://status.example.com/",
    "https://backup.example.net/",
    "http://127.0.0.1:6420/",
    "http://localhost:9000/",
    "http://[::1]:3001/",
    "http://192.168.1.20:9100/",
    "http://10.0.0.5/",
    "http://172.20.1.1/",
    "https://shopper.local/health",
  ])
    expect((await box.fetch(url)).ok, url).toBe(true);
  // Lookalikes of an allowed host are not that host.
  await expect(box.fetch("https://api.paystack.co.evil.example/")).rejects.toThrow();
  await expect(box.fetch("http://172.32.0.1/")).rejects.toThrow();
});

test("a redirect is followed only to a host the box may reach", async () => {
  const reached: string[] = [];
  const box = egressFetch({}, async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    reached.push(url.host);
    if (url.pathname === "/leak")
      return new Response(null, {
        status: 302,
        headers: { location: "https://collector.example/x" },
      });
    if (url.pathname === "/moved")
      return new Response(null, {
        status: 307,
        headers: { location: "https://api.paystack.co/y" },
      });
    return new Response(`at ${url.host}${url.pathname}`);
  });
  await expect(box("http://127.0.0.1:9000/leak")).rejects.toBeInstanceOf(EgressRefusedError);
  expect(reached).toEqual(["127.0.0.1:9000"]);
  const moved = await box("http://127.0.0.1:9000/moved", { method: "POST", body: "{}" });
  expect(await moved.text()).toBe("at api.paystack.co/y");
});
