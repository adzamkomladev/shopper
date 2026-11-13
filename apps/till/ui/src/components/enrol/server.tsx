import { useState, type FormEvent } from "react";
import { Cloud, LoaderCircle, Server } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { EnrolServer } from "../../connection/types";
import type { ServerOutcome } from "../../enrol/types";

/**
 * Where this till will enrol: the box found on the shop's network, or the Shopper cloud. When the box was not found
 * (a network that blocks shopper.local), Change server (Alt+S) takes its address; the register checks it is a box,
 * pins it and restarts on it.
 */
export function EnrolServerPanel({
  server,
  disabled,
  onChange,
}: {
  server: EnrolServer;
  disabled: boolean;
  onChange: (address: string) => Promise<ServerOutcome>;
}) {
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const cancel = () => {
    if (busy) return;
    setEditing(false);
    setError(null);
  };
  const register = useShortcuts({
    "Alt+S": () => !disabled && !changed && setEditing(true),
    ...(editing && { Escape: cancel }),
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || changed) return;
    if (!address.trim()) return setError("Type the box's address, like 192.168.1.20");
    setBusy(true);
    setError(null);
    const outcome = await onChange(address);
    setBusy(false);
    if (outcome.kind === "changed") return setChanged(true);
    setError(outcome.message);
  }

  if (editing)
    return (
      <form
        className="grid gap-3 rounded-lg border bg-muted/40 p-4"
        noValidate
        onSubmit={(event) => void submit(event)}
        ref={register}
      >
        <Field data-invalid={error ? "true" : undefined}>
          <FieldLabel htmlFor="enrol-server">Box address</FieldLabel>
          <Input
            aria-describedby={`enrol-server-${error ? "error" : "help"}`}
            aria-invalid={error ? true : undefined}
            autoCapitalize="none"
            autoComplete="off"
            autoFocus
            id="enrol-server"
            onChange={(event) => setAddress(event.target.value)}
            placeholder="e.g. 192.168.1.20"
            readOnly={busy || changed}
            spellCheck={false}
            touch
            value={address}
          />
          {error ? (
            <FieldError id="enrol-server-error">{error}</FieldError>
          ) : (
            <FieldDescription id="enrol-server-help">
              {changed
                ? `Restarting on ${address.trim()}…`
                : "The box's address on this network, like 192.168.1.20 or shopper.local."}
            </FieldDescription>
          )}
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            aria-keyshortcuts="Escape"
            disabled={busy || changed}
            onClick={cancel}
            size="touch"
            type="button"
            variant="ghost"
          >
            Cancel <Kbd className="max-sm:hidden">Esc</Kbd>
          </Button>
          <Button aria-busy={busy || changed} disabled={busy || changed} size="touch" type="submit">
            {(busy || changed) && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {changed ? "Restarting…" : busy ? "Checking…" : "Use this box"}
          </Button>
        </div>
      </form>
    );

  const Icon = server.box ? Server : Cloud;
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3" ref={register}>
      <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <div className="grid min-w-0 flex-1">
        <span className="text-sm font-medium">
          {server.box ? "Shopper box on this network" : "Shopper cloud"}
        </span>
        <span className="truncate text-xs text-muted-foreground">{server.address}</span>
      </div>
      <Button
        aria-keyshortcuts="Alt+S"
        disabled={disabled}
        onClick={() => setEditing(true)}
        size="touch"
        variant="outline"
      >
        Change server <Kbd className="max-sm:hidden">Alt+S</Kbd>
      </Button>
    </div>
  );
}
