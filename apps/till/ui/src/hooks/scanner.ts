import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

/** Consecutive key gaps below this, including the terminating Enter, make a scan. */
export const SCAN_GAP_MS = 60;
/** A single fast key then Enter is a double tap, not a scanner. */
const MIN_SCAN_LENGTH = 2;
/** Quiet time after the last keystroke before a search runs, so a scan never searches. */
export const SEARCH_DELAY_MS = 80;

type Burst = { length: number; last: number | null };
const fresh = (): Burst => ({ length: 0, last: null });

type Options = {
  /** A complete scan. The field is already cleared. */
  onScan: (code: string) => void;
  /** Slow typing paused on this text. Empty text means the field was cleared. */
  onSearch: (query: string) => void;
  /** Enter after slow typing or a paste: take the highlighted search result. */
  onEnter: (query: string) => void;
};

/**
 * Controls the one main scan field. A scanner types the whole code, then Enter, with every gap
 * under SCAN_GAP_MS; anything slower is a person searching. A scan must cover the whole field text,
 * so characters typed slowly before the burst, a paste or an edit never count as a scan. Modifier
 * chords and IME composition are ignored; other keys and paste end the burst.
 */
export function useScanField({ onScan, onSearch, onEnter }: Options) {
  const [query, setQuery] = useState("");
  const burst = useRef<Burst>(fresh());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function clear() {
    clearTimeout(timer.current);
    burst.current = fresh();
    setQuery("");
    onSearch("");
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const text = event.currentTarget.value;
    setQuery(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(text.trim()), SEARCH_DELAY_MS);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.key === "Process") {
      burst.current = fresh();
      return;
    }
    // Scanners send Shift for capitals, and chords belong to the cashier: neither breaks a burst.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Shift" || event.key === "CapsLock") return;
    const state = burst.current;
    const now = event.timeStamp;
    const fast = state.last !== null && now - state.last < SCAN_GAP_MS;
    if (event.key.length === 1) {
      burst.current = { length: fast ? state.length + 1 : 1, last: now };
      return;
    }
    if (event.key !== "Enter") {
      burst.current = fresh();
      return;
    }
    event.preventDefault();
    const code = event.currentTarget.value;
    const scanned = fast && state.length >= MIN_SCAN_LENGTH && state.length === code.length;
    if (scanned) {
      clear();
      onScan(code);
    } else {
      burst.current = fresh();
      onEnter(code.trim());
    }
  }

  const reset = () => (burst.current = fresh());
  return {
    query,
    clear,
    props: { onChange, onKeyDown, onPaste: reset, onCompositionStart: reset },
  };
}
