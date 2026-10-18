import type { DayRange } from "./types";

/** The shop's day is UTC (Ghana keeps GMT all year), so an ISO date is the day on the register. */
export const today = (): DayRange => {
  const day = new Date().toISOString().slice(0, 10);
  return { from: day, to: day };
};

/** The range the host accepts: both days set and the end not before the start. */
export const rangeError = ({ from, to }: DayRange) =>
  !from || !to ? "Choose both days" : to < from ? "The end day is before the start day" : null;

export const reportPath = ({ from, to }: DayRange, suffix = "") =>
  `/register/report${suffix}?from=${from}&to=${to}`;
