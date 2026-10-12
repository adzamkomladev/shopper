import { useRef } from "react";

/** Runs `callback` once `delayMs` have passed without another call; the last arguments win. */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cancel = () => clearTimeout(timer.current);
  const call = (...args: Args) => {
    cancel();
    timer.current = setTimeout(() => callback(...args), delayMs);
  };
  return Object.assign(call, { cancel });
}
