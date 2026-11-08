// rivetkit loads its native runtime with a computed name (`import(["@rivetkit", "rivetkit-napi"].join("/"))`), which
// a bundler cannot follow. The sealed box names it literally and leaves it for `bun build --compile`, which embeds the
// addon, so the Rivet runner runs from the one binary. If a rivetkit upgrade changes the line, the sealed Rivet test fails.
export const rivetNative = {
  name: "shopper:rivet-native",
  transform(code, id) {
    const computed = '["@rivetkit", "rivetkit-napi"].join("/")';
    if (!id.includes("/rivetkit/dist/") || !code.includes(computed)) return;
    return code.replace(computed, '"@rivetkit/rivetkit-napi"');
  },
};
