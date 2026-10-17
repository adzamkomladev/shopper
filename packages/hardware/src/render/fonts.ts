import { geistWoff } from "./fonts.gen";

const bytes = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

/** Satori font list (Geist; woff, since Satori cannot read woff2). */
export const receiptFonts = Object.entries(geistWoff).map(([weight, data]) => ({
  name: "Geist",
  data: bytes(data).buffer as ArrayBuffer,
  weight: Number(weight) as 400 | 700,
  style: "normal" as const,
}));

export const fontFaceCss = Object.entries(geistWoff)
  .map(
    ([weight, data]) =>
      `@font-face{font-family:Geist;font-weight:${weight};src:url(data:font/woff;base64,${data}) format("woff")}`,
  )
  .join("");
