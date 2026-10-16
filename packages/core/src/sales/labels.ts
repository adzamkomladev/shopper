import { and, eq } from "drizzle-orm";
import { barcodeMapping, productBarcode, price, type ShopperTransaction } from "@shopper/db-pg";
import { money, mulRatio, sub } from "@shopper/money";
import { snapshotAmount, snapshotLine } from "@shopper/tax";
import type { SaleSnapshot } from "../schemas/till/sale";
import { SaleError } from "./error";

export async function expectedLine(
  tx: ShopperTransaction,
  orgId: string,
  line: SaleSnapshot["lines"][number],
  branchId: string,
  at: Date,
) {
  if (!line.label) return snapshotLine(line.tax);
  const { code, kind } = line.label;
  const invalid = () => new SaleError("INVALID_REFERENCE", "Captured barcode label is invalid");
  if (!/^2\d{12}$/.test(code)) throw invalid();
  const checksum = Array.from(code.slice(0, 12)).reduce(
    (sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1),
    0,
  );
  if ((10 - (checksum % 10)) % 10 !== Number(code[12])) throw invalid();
  const [mapping] = await tx
    .select()
    .from(barcodeMapping)
    .where(
      and(
        eq(barcodeMapping.orgId, orgId),
        eq(barcodeMapping.prefix, Number(code.slice(0, 2))),
        eq(barcodeMapping.kind, kind),
      ),
    );
  if (!mapping) throw invalid();
  const productCode = code.slice(
    mapping.productStart,
    mapping.productStart + mapping.productLength,
  );
  const [barcode] = await tx
    .select({ id: productBarcode.id })
    .from(productBarcode)
    .where(
      and(
        eq(productBarcode.orgId, orgId),
        eq(productBarcode.productId, line.productId),
        eq(productBarcode.code, productCode),
      ),
    );
  if (!barcode) throw invalid();
  if (kind === "weight") return snapshotLine(line.tax);
  const value = Number(code.slice(mapping.valueStart, mapping.valueStart + mapping.valueLength));
  const [originalPrice] = await tx
    .select()
    .from(price)
    .where(
      and(
        eq(price.orgId, orgId),
        eq(price.id, line.label.originalPriceId),
        eq(price.productId, line.productId),
      ),
    );
  if (
    !originalPrice ||
    originalPrice.amount <= 0 ||
    originalPrice.validFrom > at ||
    (originalPrice.branchId !== null && originalPrice.branchId !== branchId) ||
    value <= 0
  )
    throw invalid();
  const encodedGross = mulRatio(money(value), 10 ** (4 - mapping.decimals), 1);
  const originalQuantity = mulRatio(encodedGross, 1000, originalPrice.amount);
  if (originalQuantity <= 0) throw invalid();
  const gross = sub(
    mulRatio(encodedGross, line.tax.quantityThousandths, originalQuantity),
    line.discount,
  );
  if (gross < 0) throw invalid();
  return { ...snapshotAmount({ ...line.tax, gross }), discount: line.discount };
}
