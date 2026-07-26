/**
 * UnitFlow Finance brand tokens, sourced from `UnitFlow-Finance/docs`
 * (app/globals.css + tailwind.config.ts, verified 2026-07-06).
 *
 * Primary teal (`#14B8A6`) and dark navy ink (`#1F2A44`) are UnitFlow's own
 * brand colors; the dark-theme surface/border/text scale mirrors the docs
 * site's `.dark` CSS variables so UnitPay reads as part of the same product
 * family. Fonts (Inter + JetBrains Mono) match the docs site exactly.
 */

export const brandTokens = {
  productName: "UnitPay",
  parentOrg: "UnitFlow Finance",
  colors: {
    primary: "#14B8A6", // teal-500 — UnitFlow primary brand color
    primaryDark: "#0D9488", // teal-600 — hover/pressed state
    primaryLight: "#134E4A", // teal-900 — subtle highlight backgrounds (badges, active nav)
    accent: "#2DD4BF", // teal-400 — links / secondary accents
    secondary: "#1F2A44", // UnitFlow navy ink
    background: "#0F1117", // dark bg
    surface: "#161B27", // dark bg-secondary
    surfaceElevated: "#1E2535", // dark bg-tertiary
    border: "#2A3347",
    foreground: "#E2E8F0", // dark-mode text
    muted: "#94A3B8", // dark-mode text-muted
    subtle: "#64748B", // dark-mode text-subtle
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F59E0B",
  },
  fontFamily: {
    sans: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
} as const;
