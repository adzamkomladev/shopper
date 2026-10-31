import { type KeyboardEvent } from "react";

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

/** The viewer's saved theme; System follows the OS. */
export type Theme = "light" | "dark" | "system";
