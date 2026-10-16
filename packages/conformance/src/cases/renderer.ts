import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import type { Renderer } from "@shopper/ports";
import type { ConformanceTest, RendererFixture } from "../types";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const papers = [
  { paperMm: 80, dots: 576, pdfPoints: 204.09 },
  { paperMm: 58, dots: 384, pdfPoints: 136.06 },
] as const;

export function rendererConformance(
  name: string,
  test: ConformanceTest,
  fixture: () => Promise<RendererFixture>,
) {
  for (const { paperMm, dots, pdfPoints } of papers) {
    test(`${name}: ${paperMm} mm PNG is ${dots} dots wide and taller than half its width`, async () => {
      await withFixture(fixture, async ({ renderer, receipt }) => {
        const size = pngSize(await renderer.receipt(receipt, { paperMm, reprint: false }, "png"));
        assert.equal(size.width, dots);
        assert.ok(size.height > dots / 2, `height ${size.height} is not above ${dots / 2}`);
      });
    });
    test(`${name}: ${paperMm} mm PDF is one ${pdfPoints} pt page matching the PNG ratio`, async () => {
      await withFixture(fixture, async ({ renderer, receipt }) => {
        const options = { paperMm, reprint: false };
        const pdf = await renderer.receipt(receipt, options, "pdf");
        assert.equal(Buffer.from(pdf.subarray(0, 5)).toString("latin1"), "%PDF-");
        const document = await PDFDocument.load(pdf);
        assert.equal(document.getPageCount(), 1);
        const page = document.getPage(0).getSize();
        assert.ok(Math.abs(page.width - pdfPoints) <= 0.5, `page width ${page.width} pt`);
        const png = pngSize(await renderer.receipt(receipt, options, "png"));
        const ratio = page.height / page.width / (png.height / png.width);
        assert.ok(Math.abs(ratio - 1) <= 0.02, `PDF/PNG height ratio ${ratio}`);
      });
    });
  }

  test(`${name}: more receipt lines render a taller image`, async () => {
    await withFixture(fixture, async ({ renderer, receipt }) => {
      const longer = structuredClone(receipt) as { lines: unknown[] };
      longer.lines = [...longer.lines, ...longer.lines, ...longer.lines];
      const options = { paperMm: 80, reprint: false } as const;
      const short = pngSize(await renderer.receipt(receipt, options, "png"));
      const tall = pngSize(await renderer.receipt(longer as typeof receipt, options, "png"));
      assert.ok(tall.height > short.height, `${tall.height} is not taller than ${short.height}`);
    });
  });

  test(`${name}: a reprint renders different image bytes than the original`, async () => {
    await withFixture(fixture, async ({ renderer, receipt }) => {
      const original = await renderer.receipt(receipt, { paperMm: 80, reprint: false }, "png");
      const reprint = await renderer.receipt(receipt, { paperMm: 80, reprint: true }, "png");
      assert.notDeepEqual(reprint, original);
    });
  });
  test(`${name}: an invalid receipt is rejected`, async () => {
    await withFixture(fixture, async ({ renderer }) => {
      await assert.rejects(renderer.receipt({ v: 1 }, { paperMm: 80, reprint: false }, "png"));
    });
  });
}

async function withFixture(
  fixture: () => Promise<RendererFixture>,
  run: (f: RendererFixture & { renderer: Renderer }) => Promise<void>,
) {
  const f = await fixture();
  try {
    await run(f);
  } finally {
    await f.close();
  }
}

/** Width and height from the IHDR chunk, after checking the PNG signature. */
function pngSize(png: Uint8Array) {
  assert.deepEqual([...png.subarray(0, 8)], PNG_SIGNATURE);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
