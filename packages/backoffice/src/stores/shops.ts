import { stored, type Shop } from "../schemas/shops";
export { type Shop } from "../schemas/shops";
import { useSyncExternalStore } from "react";
import * as v from "valibot";

const STORAGE_KEY = "shopper.shops";

type State = v.InferOutput<typeof stored>;

const listeners = new Set<() => void>();
let state = load();

/** The shops this device has signed in to, and the one the API calls are made for. */
export function useShops() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function currentShop() {
  return state.shops.find((candidate) => candidate.id === state.currentId);
}

/** Adds the shop (or updates its name and code) and makes it the current one. */
export function rememberShop(next: Shop) {
  save({ shops: [...state.shops.filter((item) => item.id !== next.id), next], currentId: next.id });
}

export function selectShop(id: string) {
  save({ ...state, currentId: id });
}

function save(next: State) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage is blocked (private window): the list lasts for this tab only.
  }
  for (const notify of listeners) notify();
}

function load(): State {
  try {
    const parsed = v.safeParse(stored, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
    if (parsed.success) return parsed.output;
  } catch {
    // Blocked or corrupt storage starts an empty list.
  }
  return { shops: [], currentId: null };
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    state = load();
    notify();
  };
  listeners.add(notify);
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    removeEventListener("storage", onStorage);
  };
}
