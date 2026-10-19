import type { ReceiptDocument } from "@shopper/core/receipts";
import {
  ghs,
  qrCaption,
  qrPayload,
  quantity,
  refundedLabel,
  taxRows,
  tenderDetail,
  tenderLabel,
} from "../format";
import { paper } from "../profiles";
import type { PaperMm } from "../types";
import { Center, Row, Rule, Stack, qrImage } from "./parts";

/**
 * The thermal receipt as a Satori-safe tree; mirrors `encodeReceipt` line for line. Line heights are
 * whole pixels because Satori rounds fractional ones up, which drifts from Chromium line by line.
 */
export function ReceiptView({
  receipt,
  paperMm,
  reprint,
}: {
  receipt: ReceiptDocument;
  paperMm: PaperMm;
  reprint: boolean;
}) {
  const { header, taxSummary } = receipt;
  const bold = { fontWeight: 700 } as const;
  const refund = receipt.kind === "refund";
  return (
    <Stack
      style={{
        width: paper[paperMm].dots,
        padding: 16,
        background: "#fff",
        color: "#000",
        fontFamily: "Geist",
        fontSize: 22,
        lineHeight: "30px",
      }}
    >
      <Center style={{ ...bold, fontSize: 34, lineHeight: "41px" }}>{header.org}</Center>
      {header.tin ? <Center>{`TIN ${header.tin}`}</Center> : null}
      <Center>{header.branch}</Center>
      {header.address ? <Center>{header.address}</Center> : null}
      {reprint ? <Center style={{ ...bold, margin: "8px 0" }}>*** REPRINT ***</Center> : null}
      {refund ? (
        <Center style={{ ...bold, fontSize: 30, lineHeight: "40px", margin: "8px 0" }}>
          REFUND
        </Center>
      ) : null}
      <Rule />
      {refund ? <Center>{`Refund of ${receipt.refundOf ?? "an earlier sale"}`}</Center> : null}
      {header.receiptNumber ? <Row left="Receipt" right={header.receiptNumber} /> : null}
      <Row left="Date" right={header.accraTime} />
      <Row left="Cashier" right={header.cashier} />
      <Rule />
      {receipt.lines.map((line, index) => (
        <Stack key={`${line.name}-${index}`}>
          <div style={{ display: "flex", ...bold }}>{line.name}</div>
          <Row
            left={`${quantity(line.quantityThousandths)} × ${ghs(line.unitPrice)}`}
            right={ghs(line.gross)}
          />
        </Stack>
      ))}
      <Rule />
      {taxRows(taxSummary).map(([label, amount]) => (
        <Row key={label} left={label} right={ghs(amount)} />
      ))}
      <Rule />
      <Row
        left="TOTAL"
        right={ghs(receipt.total)}
        style={{ ...bold, fontSize: 28, lineHeight: "38px" }}
      />
      {receipt.tenders.map((tender, index) => {
        if (refund)
          return <Row key={index} left={refundedLabel(tender)} right={ghs(tender.amount)} />;
        const detail = tenderDetail(tender);
        return (
          <Stack key={`${tender.kind}-${index}`}>
            <Row left={tenderLabel[tender.kind]} right={ghs(tender.amount)} />
            {detail ? (
              <div style={{ display: "flex", fontSize: 18, lineHeight: "24px" }}>{detail}</div>
            ) : null}
          </Stack>
        );
      })}
      {refund ? null : <Row left="Change" right={ghs(receipt.change)} />}
      {refund ? null : (
        <Center style={{ margin: "16px 0 4px" }}>{qrImage(qrPayload(receipt), 200)}</Center>
      )}
      {refund ? null : <Center style={{ fontSize: 18, lineHeight: "24px" }}>{qrCaption}</Center>}
      <Center style={{ marginTop: 12 }}>{receipt.footer}</Center>
    </Stack>
  );
}
