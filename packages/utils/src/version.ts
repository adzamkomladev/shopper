/**
 * Orders two `major.minor.patch[-prerelease][+build]` versions: negative when `a` is older. Each part compares as a
 * number, a prerelease sorts below its release (`0.1.1-rc.1` < `0.1.1`), numeric prerelease parts compare as numbers
 * (`rc.9` < `rc.10`), and a leading `v` and `+build` metadata are ignored, so an operator's `v0.3.0` still counts.
 */
export function compareVersions(a: string, b: string) {
  const [coreA = "", preA] = a.replace(/^v/, "").split("+")[0]!.split(/-(.*)/s);
  const [coreB = "", preB] = b.replace(/^v/, "").split("+")[0]!.split(/-(.*)/s);
  const core = compareParts(coreA.split("."), coreB.split("."));
  if (core) return core;
  if (preA === preB) return 0;
  if (!preA) return 1;
  if (!preB) return -1;
  return compareParts(preA.split("."), preB.split(".")) || 0;
}

function compareParts(a: string[], b: string[]) {
  return Array.from({ length: Math.max(a.length, b.length, 3) }, (_, i) => {
    const x = a[i] ?? "0";
    const y = b[i] ?? "0";
    return /^\d+$/.test(x) && /^\d+$/.test(y) ? Number(x) - Number(y) : x < y ? -1 : x > y ? 1 : 0;
  }).find((difference) => difference !== 0);
}
