declare module "harfbuzzjs/hb.js" {
  const createHarfBuzz: (options: { wasmBinary: ArrayBuffer }) => Promise<unknown>;
  export default createHarfBuzz;
}
declare module "harfbuzzjs/hbjs.js" {
  const hbjs: (instance: unknown) => unknown;
  export default hbjs;
}
