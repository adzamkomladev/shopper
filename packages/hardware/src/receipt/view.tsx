import type { ReceiptDocument } from "@shopper/core/receipts";
import {
  beforeTax,
  clip,
  documentTitle,
  ghs,
  fiscalMark,
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
  const { header } = receipt;
  const bold = { fontWeight: 700 } as const;
  const refund = receipt.kind === "refund";
  const mark = fiscalMark(receipt);
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
          CREDIT NOTE
        </Center>
      ) : (
        <Center style={bold}>{documentTitle(receipt)}</Center>
      )}
      <Rule />
      {refund ? (
        <Center>{`Credit note for ${receipt.refundOf ?? "an earlier sale"}`}</Center>
      ) : null}
      {header.receiptNumber ? (
        <Row left={refund ? "Credit note" : "Receipt"} right={header.receiptNumber} />
      ) : null}
      <Row left="Date" right={header.accraTime} />
      <Row left="Cashier" right={header.cashier} />
      {receipt.buyer ? (
        <Stack>
          <div style={{ display: "flex", ...bold }}>Buyer</div>
          <div style={{ display: "flex" }}>{clip(receipt.buyer.name, paper[paperMm].cols)}</div>
          <div style={{ display: "flex" }}>{`TIN ${receipt.buyer.tin}`}</div>
        </Stack>
      ) : null}
      <Rule />
      {receipt.lines.map((line, index) => (
        <Stack key={`${line.name}-${index}`}>
          <div style={{ display: "flex", ...bold }}>{line.name}</div>
          <Row
            left={`${quantity(line.quantityThousandths)} × ${ghs(line.unitPrice)}`}
            right={ghs(line.gross)}
          />
          {receipt.buyer && line.net !== null ? (
            <Row
              left={beforeTax({ ...line, net: line.net })[0]}
              right={beforeTax({ ...line, net: line.net })[1]}
            />
          ) : null}
        </Stack>
      ))}
      <Rule />
      {taxRows(receipt).map(([label, amount]) => (
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
      {mark?.qr ? <Center style={{ margin: "16px 0 4px" }}>{qrImage(mark.qr, 200)}</Center> : null}
      {mark ? (
        <Center style={{ fontSize: 18, lineHeight: "24px", marginTop: mark.qr ? 0 : 12 }}>
          {mark.caption}
        </Center>
      ) : null}
      <Center style={{ marginTop: 12 }}>{receipt.footer}</Center>
    </Stack>
  );
}
