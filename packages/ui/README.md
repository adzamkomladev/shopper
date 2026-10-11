# @shopper/ui

shadcn/ui (new-york, slate) on Tailwind v4, shared by the till, the portal and the shop.

- `src/styles/theme.css` is the only token file. Apps import it as `@shopper/ui/styles.css`.
- `src/components/` holds the shadcn components added with `vp dlx shadcn@<pin from .mcp.json> add <name>`
  run inside this folder (`components.json`), plus our compositions: `data-table`, `money`,
  `app-backdrop`, `about`. Never copy a component into an app; restyle through tokens and variants.
- `src/hooks/` holds `use-online` and the `shortcuts` registry (`ShortcutRoot`, `useShortcuts`).
- Import by subpath: `@shopper/ui/components/button`, `@shopper/ui/hooks/use-online`.
