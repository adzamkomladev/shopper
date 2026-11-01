import { useState } from "react";
import { SearchIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#components/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "#components/input/group";
import { Kbd } from "#components/kbd";
import { displayKeys } from "#hooks/modkey";
import type { ShortcutGroup } from "./types";
export type { Shortcut, ShortcutGroup } from "./types";

/**
 * Every shortcut in groups, with a search box: the web apps' Keyboard shortcuts dialog (?) and the
 * till's Help (F1). Esc closes it and focus goes back to what opened it.
 */
export function ShortcutsDialog({
  open,
  onOpenChange,
  title = "Keyboard shortcuts",
  groups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  groups: readonly ShortcutGroup[];
}) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const shown = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${item.keys} ${group.label}`.toLowerCase().includes(term),
      ),
    }))
    .filter((group) => group.items.length > 0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent className="flex max-h-160 flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Every key that works here, by area.</DialogDescription>
        </DialogHeader>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            aria-label="Search shortcuts"
            placeholder="Search shortcuts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
        {/* Focusable, so a keyboard can scroll a long list (axe: scrollable-region-focusable). */}
        <div
          className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          tabIndex={0}
        >
          {shown.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No shortcut matches.</p>
          )}
          {shown.map((group) => (
            <section key={group.label} aria-label={group.label} className="py-2">
              <h3 className="pb-1 text-xs font-medium text-muted-foreground">{group.label}</h3>
              <dl className="divide-y">
                {group.items.map((item) => (
                  <div
                    key={`${item.keys} ${item.label}`}
                    className="flex items-center gap-4 py-1.5"
                  >
                    <dt className="flex-1 text-sm">{item.label}</dt>
                    <dd>
                      <Kbd>{item.keys}</Kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The shortcuts the page's own controls announce through aria-keyshortcuts, read when the dialog
 * opens, so the list always matches what is on screen.
 */
export function pageShortcuts(root: ParentNode = document) {
  const seen = new Set<string>();
  return [...root.querySelectorAll<HTMLElement>("[aria-keyshortcuts]")].flatMap((element) => {
    const keys = displayKeys(element.getAttribute("aria-keyshortcuts")!);
    const label = (element.getAttribute("aria-label") ?? element.textContent ?? "").trim();
    const id = `${keys} ${label}`;
    if (!label || seen.has(id) || element.closest("[aria-hidden=true], [hidden]")) return [];
    seen.add(id);
    return [{ keys, label }];
  });
}
