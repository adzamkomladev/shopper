import { PDFDocument } from "pdf-lib";
import { paper } from "../profiles";
import type { PaperMm } from "../types";

const POINTS_PER_MM = 72 / 25.4;
/** A4 across, in points. */
export const A4_POINTS = 210 * POINTS_PER_MM;
export const A4_HEIGHT_POINTS = 297 * POINTS_PER_MM;

/** One page at paper width (mm → pt), tall enough for the PNG's aspect, image drawn full-page. */
export const pngPdf = (png: Uint8Array, paperMm: PaperMm) =>
  pngPage(png, paper[paperMm].mm * POINTS_PER_MM);

/**
 * Pages `width` points across with the image drawn full-width. A tall image becomes as many `maxHeight` pages as it
 * needs, the last one shorter; without a `maxHeight` it is one page as tall as the image's aspect.
 */
export async function pngPage(png: Uint8Array, width: number, maxHeight = Infinity) {
  const document = await PDFDocument.create();
  const image = await document.embedPng(png);
  const height = (width * image.height) / image.width;
  for (let top = 0; top < height; top += maxHeight) {
    const pageHeight = Math.min(maxHeight, height - top);
    document
      .addPage([width, pageHeight])
      .drawImage(image, { x: 0, y: pageHeight + top - height, width, height });
  }
  return document.save();
}
