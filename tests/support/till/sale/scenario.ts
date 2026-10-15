import { v7 } from "uuid";
import { createConnectionHost } from "../connection/host";
import { startBridgeProxy } from "../connection/proxy";
import { createConnectionServer } from "../connection/server";
import { startHostUpstream } from "../host/upstream";

const names = [
  ["MILO-400", "Milo 400g tin", 4_250_000],
  ["PEAK-160", "Peak milk 160g", 165_000],
  ["TITUS-125", "Titus sardines 125g", 180_000],
  ["GINO-400", "Gino tomato paste 400g", 320_000],
  ["FRYTOL-1L", "Frytol oil 1L", 450_000],
  ["ROYAL-5KG", "Royal Aroma rice 5kg", 1_850_000],
  ["SUNL-500", "Sunlight soap 500g", 120_000],
  ["VOLTIC-1500", "Voltic water 1.5L", 80_000],
  ["ONGA-50", "Onga seasoning 50g", 60_000],
  ["MAGGI-100", "Maggi cubes 100g", 95_000],
] as const;

/**
 * A real register host with ten barcoded products under Ghana standard rates (VAT 15%, NHIL 2.5%,
 * GETFund 2.5%). The server is unreachable, so the till sells offline on its provisioned catalogue.
 */
export async function startSaleScenario(appOrigin: string) {
  const server = await createConnectionServer("connected-empty");
  const cleanups: (() => Promise<unknown> | void)[] = [() => server.close()];
  const stop = async () => {
    for (const cleanup of cleanups.reverse()) await cleanup();
  };
  try {
    const upstream = await startHostUpstream(server.api);
    cleanups.push(() => upstream.close());
    // Push, pull and live are all down: the till never replaces its provisioned catalogue.
    upstream.setAvailable(false);
    upstream.setPullAvailable(false);
    upstream.setLiveAvailable(false);
    const products = names.map(([sku, name, amount], index) => ({
      product: {
        id: v7(),
        orgId: server.identity.orgId,
        sku,
        name,
        baseUnit: "each",
        taxClass: "standard",
        archivedAt: null,
        barcodes: [
          { code: ean13(`600123400${String(index).padStart(3, "0")}`), quantityThousandths: 1000 },
        ],
      },
      amount,
    }));
    const references = {
      ...server.references,
      products: products.map((entry) => entry.product),
      prices: products.map(({ product, amount }) => ({
        id: v7(),
        orgId: server.identity.orgId,
        productId: product.id,
        branchId: null,
        amount,
        validFrom: "2025-01-01T00:00:00.000Z",
        validTo: null,
      })),
      taxRules: [
        ...server.references.taxRules,
        {
          id: v7(),
          orgId: server.identity.orgId,
          effectiveFrom: "2026-06-01",
          vatBps: 1_500,
          nhilBps: 250,
          getfundBps: 250,
          covidBps: 0,
          source: "e2e: Ghana standard rates",
        },
      ],
    };
    const fixture = await createConnectionHost(server, upstream.url, appOrigin, references);
    cleanups.push(() => fixture.close());
    const host = await fixture.start();
    const bridge = await startBridgeProxy(host.ready.port, false);
    cleanups.push(() => bridge.close());
    return {
      url: `${appOrigin}/#${encodeURIComponent(host.ready.capability)}`,
      products: products.map(({ product, amount }) => ({
        sku: product.sku,
        name: product.name,
        barcode: product.barcodes[0]!.code,
        amount,
      })),
      stop,
    };
  } catch (error) {
    await stop();
    throw error;
  }
}

function ean13(body: string) {
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) sum += Number(body[i]) * (i % 2 ? 3 : 1);
  return `${body}${(10 - (sum % 10)) % 10}`;
}
