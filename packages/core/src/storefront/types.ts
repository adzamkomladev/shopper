import type { quoteCart } from "./cart";

export type CartQuote = Awaited<ReturnType<typeof quoteCart>>;
