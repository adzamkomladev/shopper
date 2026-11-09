import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../../../packages/ui/src/styles/theme.css", import.meta.url),
  "utf8",
);

/** The `light-dark(light, dark)` pair `@shopper/ui` declares for a token, as sRGB hex. */
export function themeToken(name: string) {
  const pair = css.match(
    new RegExp(`--${name}: light-dark\\((oklch\\([^)]+\\)),\\s*(oklch\\([^)]+\\))\\)`),
  );
  if (!pair) throw new Error(`--${name} is not a light-dark token in theme.css`);
  return { light: hex(pair[1]!), dark: hex(pair[2]!) };
}

/** WCAG contrast ratio of two #rrggbb colours. */
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function luminance(color: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(color.slice(i, i + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** OKLCH to sRGB (Björn Ottosson's matrices), clamped to the gamut. */
function hex(oklch: string) {
  const [L, C, h = 0] = oklch
    .match(/oklch\(([^)]+)\)/)![1]!
    .split(/\s+/)
    .map(Number) as [number, number, number?];
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    linear
      .map((x) => {
        const c = Math.min(1, Math.max(0, x));
        const gamma = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
        return Math.round(gamma * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}
