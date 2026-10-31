/**
 * Orders two `major.minor.patch[-prerelease]` versions: negative when `a` is older. Each part compares as a number,
 * and a prerelease sorts below its release (`0.1.1-rc.1` < `0.1.1`); prerelease tags compare as text.
 */
export function compareVersions(a: string, b: string) {
  const [coreA = "", preA] = a.split("-", 2);
  const [coreB = "", preB] = b.split("-", 2);
  const partsA = coreA.split(".").map(Number);
  const partsB = coreB.split(".").map(Number);
  const core = [0, 1, 2].map((i) => (partsA[i] ?? 0) - (partsB[i] ?? 0)).find((d) => d !== 0);
  if (core) return core;
  if (preA === preB) return 0;
  if (preA === undefined) return 1;
  if (preB === undefined) return -1;
  return preA < preB ? -1 : 1;
}
