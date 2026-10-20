/**
 * Mod+Enter saves and Escape goes back. Escape is left alone when a menu or dialog took it
 * (it marks the event handled), so closing a menu never loses the draft.
 */
export function entryKeys({ submit, back }: { submit: () => void; back: () => void }) {
  return (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape" && !event.defaultPrevented) back();
  };
}
