import { PDFDocument } from "pdf-lib";
import { paper } from "../profiles";
import type { PaperMm } from "../types";

const POINTS_PER_MM = 72 / 25.4;

/** One page at paper width (mm → pt), tall enough for the PNG's aspect, image drawn full-page. */
export async function pngPdf(png: Uint8Array, paperMm: PaperMm) {
  const document = await PDFDocument.create();
  const image = await document.embedPng(png);
  const width = paper[paperMm].mm * POINTS_PER_MM;
  const height = (width * image.height) / image.width;
  document.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  return document.save();
}
