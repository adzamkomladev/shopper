/**
 * The `@shopper/ui` colour tokens as sRGB hex, light and dark. Email clients read neither `oklch()` nor CSS
 * variables, so the values are converted from `packages/ui/src/styles/theme.css`; a test fails when they drift.
 */
export const emailColors = {
  background: { light: "#ffffff", dark: "#020617" },
  foreground: { light: "#020617", dark: "#f8fafc" },
  primary: { light: "#155058", dark: "#5eb8c1" },
  primaryForeground: { light: "#ffffff", dark: "#020617" },
  mutedForeground: { light: "#64748b", dark: "#94a3b8" },
  border: { light: "#e2e8f0", dark: "#1e293b" },
  page: { light: "#f0fdf4", dark: "#04140f" },
  warning: { light: "#fff3d8", dark: "#36280c" },
  warningForeground: { light: "#6b4300", dark: "#f9da98" },
  warningBorder: { light: "#f7c75b", dark: "#7d5e07" },
} as const;
