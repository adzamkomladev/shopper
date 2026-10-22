import { PDFDocument } from "pdf-lib";
import { paper } from "../profiles";
import type { PaperMm } from "../types";

const POINTS_PER_MM = 72 / 25.4;
/** A4 across, in points. */
export const A4_POINTS = 210 * POINTS_PER_MM;

/** One page at paper width (mm → pt), tall enough for the PNG's aspect, image drawn full-page. */
export const pngPdf = (png: Uint8Array, paperMm: PaperMm) =>
  pngPage(png, paper[paperMm].mm * POINTS_PER_MM);

/** One page `width` points across and as tall as the PNG's aspect needs, the image drawn full-page. */
export async function pngPage(png: Uint8Array, width: number) {
  const document = await PDFDocument.create();
  const image = await document.embedPng(png);
  const height = (width * image.height) / image.width;
  document.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  return document.save();
}
