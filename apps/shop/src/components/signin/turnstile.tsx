declare global {
  interface Window {
    turnstile?: {
      render: (node: HTMLElement, options: Record<string, unknown>) => string;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare's robot check, drawn only when the shop has a site key; the token goes with "Text me a code". */
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  // A ref callback with cleanup (React 19) mounts the widget: no effect needed.
  const mount = (node: HTMLDivElement | null) => {
    if (!node) return;
    let id: string | undefined;
    const render = () => {
      id = window.turnstile?.render(node, {
        sitekey: siteKey,
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
    };
    if (window.turnstile) render();
    else {
      const script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      script.onload = render;
      document.head.append(script);
    }
    return () => {
      if (id) window.turnstile?.remove(id);
    };
  };
  return <div ref={mount} className="min-h-16" />;
}
