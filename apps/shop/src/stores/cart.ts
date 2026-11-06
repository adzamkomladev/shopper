import { useSyncExternalStore } from "react";
import * as v from "valibot";
import { storedCart, type CartLine } from "../schemas/cart";
export type { CartLine } from "../schemas/cart";

const empty: CartLine[] = [];
const listeners = new Set<() => void>();
// Read lazily per shop: the server renders an empty basket and the browser fills it in after hydration.
const carts = new Map<string, CartLine[]>();
const keyOf = (shop: string) => `shopper.cart.${shop}`;

/** The basket this browser keeps for one shop. It survives reloads, follows other tabs and never reaches the server. */
export function useCart(shop: string) {
  return useSyncExternalStore(
    subscribe,
    () => cartOf(shop),
    () => empty,
  );
}

export function cartOf(shop: string) {
  const cached = carts.get(shop);
  if (cached) return cached;
  const loaded = load(shop);
  carts.set(shop, loaded);
  return loaded;
}

/** Adds to a line, or starts one. */
export function addToCart(shop: string, productId: string, quantityThousandths: number) {
  const lines = cartOf(shop);
  const found = lines.find((line) => line.productId === productId);
  save(
    shop,
    found
      ? lines.map((line) =>
          line === found
            ? {
                ...line,
                quantityThousandths: Math.min(
                  1_000_000,
                  line.quantityThousandths + quantityThousandths,
                ),
              }
            : line,
        )
      : [...lines, { productId, quantityThousandths }],
  );
}

/** Sets a line's quantity; zero removes it. */
export function setQuantity(shop: string, productId: string, quantityThousandths: number) {
  save(
    shop,
    quantityThousandths <= 0
      ? cartOf(shop).filter((line) => line.productId !== productId)
      : cartOf(shop).map((line) =>
          line.productId === productId
            ? { ...line, quantityThousandths: Math.min(1_000_000, quantityThousandths) }
            : line,
        ),
  );
}

export const clearCart = (shop: string) => save(shop, []);

function save(shop: string, lines: CartLine[]) {
  carts.set(shop, lines);
  try {
    localStorage.setItem(keyOf(shop), JSON.stringify(lines));
  } catch {
    // Storage is blocked (private window): the basket lasts for this tab only.
  }
  for (const notify of listeners) notify();
}

function load(shop: string): CartLine[] {
  try {
    const parsed = v.safeParse(storedCart, JSON.parse(localStorage.getItem(keyOf(shop)) ?? "[]"));
    if (parsed.success) return parsed.output;
  } catch {
    // Blocked or corrupt storage starts an empty basket.
  }
  return empty;
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith("shopper.cart.")) return;
    carts.delete(event.key.slice("shopper.cart.".length));
    notify();
  };
  listeners.add(notify);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}
