import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { fiscalDoc, receiptEmail, sale, type ShopperDatabase } from "@shopper/db-pg";
import { formatGHS } from "@shopper/money";
import type { Delivery, Json } from "@shopper/ports";
import { formatQuantity } from "@shopper/utils";
import type { StatementDeliveryDeps } from "../../customers";
import { receiptDocument, type ReceiptDocument } from "../../schemas/receipts/document";
import { receiptEmailMessage } from "../schemas/email";
import { markReceiptSent } from "./commands";

/**
 * Sends one receipt email: the stored receipt JSON, stamped with the SDC's signature once it has one, rendered to a
 * PDF by the shared renderer and summed up in the text. A row already sent acks; a missing channel retries.
 */
export async function deliverReceiptEmail(deps: StatementDeliveryDeps, delivery: Delivery) {
  const message = v.parse(receiptEmailMessage, delivery.message);
  const orgId = delivery.message.orgId;
  const found = await readReceipt(deps.db, orgId, message.payload.id);
  if (!found || found.sentAt) return await delivery.ack();
  if (!deps.mail || !deps.renderer) return await delivery.retry();
  const receipt = found.receipt;
  const number = receipt.header.receiptNumber ?? receipt.saleId;
  const pdf = await deps.renderer.receipt(
    receipt as unknown as Json,
    { paperMm: 80, reprint: false },
    "pdf",
  );
  const reference = await deps.mail({
    email: found.email,
    subject: `Your receipt ${number} from ${receipt.header.org}`,
    link: deps.baseUrl ?? "",
    plain: receiptText(receipt, number),
    attachments: [
      { fileName: `receipt-${number}.pdf`, contentType: "application/pdf", content: pdf },
    ],
  });
  await markReceiptSent(
    deps.db,
    { orgId, appVersion: deps.appVersion },
    { id: found.id, reference },
  );
  await delivery.ack();
}

/** The email row with its sale's receipt, carrying the SDC signature when the stored copy predates it. */
async function readReceipt(db: ShopperDatabase, orgId: string, id: string) {
  const [row] = await db
    .select({ email: receiptEmail, receipt: sale.receipt, fiscal: fiscalDoc })
    .from(receiptEmail)
    .innerJoin(sale, and(eq(sale.orgId, receiptEmail.orgId), eq(sale.id, receiptEmail.saleId)))
    .leftJoin(fiscalDoc, and(eq(fiscalDoc.orgId, sale.orgId), eq(fiscalDoc.saleId, sale.id)))
    .where(and(eq(receiptEmail.orgId, orgId), eq(receiptEmail.id, id)));
  if (!row) return undefined;
  const receipt = v.parse(receiptDocument, row.receipt);
  const signed = row.fiscal?.status === "accepted" ? row.fiscal : null;
  return {
    id: row.email.id,
    email: row.email.email,
    sentAt: row.email.sentAt,
    receipt: {
      ...receipt,
      fiscal:
        receipt.fiscal ??
        (signed && {
          sdcId: signed.sdcId!,
          counter: signed.sdcCounter!,
          signature: signed.signature!,
          qr: signed.qr!,
          signedAt: (signed.signedAt ?? signed.acceptedAt!).toISOString(),
        }),
    },
  };
}

function receiptText(receipt: ReceiptDocument, number: string) {
  return [
    `Thank you for shopping at ${receipt.header.org}, ${receipt.header.branch}.`,
    `Receipt ${number}, ${receipt.header.accraTime}`,
    "",
    ...receipt.lines.map(
      (line) =>
        `${formatQuantity(line.quantityThousandths)} × ${line.name}: ${formatGHS(line.gross)}`,
    ),
    "",
    `Total ${formatGHS(receipt.total)}`,
    ...receipt.tenders.map((tender) => `Paid by ${tender.kind}: ${formatGHS(tender.amount)}`),
    ...(receipt.change > 0 ? [`Change ${formatGHS(receipt.change)}`] : []),
    ...(receipt.fiscal
      ? [
          "",
          `Fiscal code: ${receipt.fiscal.signature} (SDC ${receipt.fiscal.sdcId}, ${receipt.fiscal.counter})`,
        ]
      : []),
    "",
    "Your receipt is attached as a PDF.",
  ].join("\n");
}
