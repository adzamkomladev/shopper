import { useSyncExternalStore } from "react";

// Tailwind's md breakpoint: below it the sidebar becomes a sheet.
const query = "(max-width: 767px)";

export function useMobile() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
}

function subscribe(notify: () => void) {
  const media = matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
