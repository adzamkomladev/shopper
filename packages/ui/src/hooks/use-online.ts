import { useSyncExternalStore } from "react";

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

function subscribe(notify: () => void) {
  addEventListener("online", notify);
  addEventListener("offline", notify);
  return () => {
    removeEventListener("online", notify);
    removeEventListener("offline", notify);
  };
}
