/**
 * Figma "Application title bar". In Electron the window is frameless: this bar drags it and the OS
 * draws the window controls over its right edge. In a browser it is a plain header.
 */
export function TitleBar() {
  return (
    <div className="app-drag flex h-10 shrink-0 items-center gap-3 border-b bg-card px-4 select-none">
      <span aria-hidden="true" className="size-6 rounded-full bg-border" />
      <p className="text-base font-semibold tracking-tight">Shopper App</p>
    </div>
  );
}
