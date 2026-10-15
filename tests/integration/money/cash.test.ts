import { expect, test } from "vite-plus/test";
import { fromPesewas, money, roundCash, toPesewas, wholePesewas } from "@shopper/money";

const TEN_PESEWAS = 1000;

test.each([
  [0, 0],
  [499, 0],
  [500, 1000],
  [1499, 1000],
  [1500, 2000],
  [9999, 10000],
  [10000, 10000],
  [123456, 123000],
  [123500, 124000],
])("roundCash rounds %i to %i at the 10 pesewa step, ties up", (amount, expected) => {
  expect(roundCash(money(amount), TEN_PESEWAS)).toBe(expected);
});

test.each([
  [-499, 0],
  [-500, -1000],
  [-1500, -2000],
  [-123456, -123000],
])("roundCash mirrors negatives: %i becomes %i", (amount, expected) => {
  expect(roundCash(money(amount), TEN_PESEWAS)).toBe(expected);
});

test("roundCash works at other positive steps and returns Money", () => {
  expect(roundCash(money(250), 100)).toBe(300);
  expect(roundCash(money(249), 100)).toBe(200);
  expect(roundCash(money(7), 1)).toBe(7);
});

test.each([0, -1000, 1.5, Number.NaN])("roundCash rejects the step %s", (step) => {
  expect(() => roundCash(money(100), step)).toThrow(RangeError);
});

test("fromPesewas and toPesewas are inverse for whole pesewas", () => {
  expect(fromPesewas(1)).toBe(100);
  expect(fromPesewas(2550)).toBe(255000);
  expect(toPesewas(fromPesewas(-37))).toBe(-37);
  expect(() => fromPesewas(0.5)).toThrow();
});

test("wholePesewas accepts whole pesewas and rejects fractions of a pesewa", () => {
  expect(wholePesewas(money(255000))).toBe(255000);
  expect(wholePesewas(money(0))).toBe(0);
  expect(() => wholePesewas(money(255050))).toThrow(RangeError);
  expect(() => wholePesewas(money(1))).toThrow(RangeError);
});
