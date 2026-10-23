import { fromDecimal, money, toDecimal } from "@shopper/money";

/** A percentage typed as a decimal with at most two places, like "2.5". */
export const RATE_PATTERN = /^\d{1,3}(?:\.\d{1,2})?$/;

/**
 * Basis points from a percentage. Money has four decimal places, so "2.5" read as money is 25000: a
 * hundred times the 250 basis points it means. A rate with at most two places divides exactly.
 */
export const percentToBps = (percent: string) => fromDecimal(percent.trim()) / 100;

/** The percentage a rate in basis points is typed as, with two places: 250 is "2.50". */
export const bpsToPercent = (bps: number) => toDecimal(money(bps * 100));
