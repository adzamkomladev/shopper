import createHarfBuzz from "harfbuzzjs/hb.js";
import hbjs from "harfbuzzjs/hbjs.js";
import { embeddedPack } from "../pack";

// Satori's text shaper. The package finds its wasm beside its own source file, a path that exists only on the machine
// that built the box; the sealed build aliases `harfbuzzjs` here so the wasm comes out of the binary instead.
export default (async () => {
  const wasm = (await embeddedPack())?.file("wasm/hb.wasm");
  if (!wasm) throw new Error("hb.wasm is not embedded in this binary");
  return hbjs(await createHarfBuzz({ wasmBinary: await wasm.arrayBuffer() }));
})();
