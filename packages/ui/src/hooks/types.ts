import { type KeyboardEvent } from "react";

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;
