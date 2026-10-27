import { add, fromDecimal, mulQty, type Money } from "@shopper/money";

const STORE = fromDecimal("550");
const SECOND_AND_THIRD = fromDecimal("300");
const FOURTH_ON = fromDecimal("250");

/**
 * A month's price for an org with these registers per store: GHS 550 a store, its first register included; GHS 300
 * each for its second and third; GHS 250 each from its fourth.
 */
export function invoiceAmount(registersPerStore: number[]) {
  return registersPerStore.reduce<Money>(
    (total, registers) =>
      add(
        add(total, STORE),
        add(
          mulQty(SECOND_AND_THIRD, Math.min(Math.max(registers - 1, 0), 2) * 1000),
          mulQty(FOURTH_ON, Math.max(registers - 3, 0) * 1000),
        ),
      ),
    fromDecimal("0"),
  );
}
