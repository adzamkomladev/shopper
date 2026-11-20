import { useForm } from "@tanstack/react-form";
import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@shopper/ui/components/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@shopper/ui/components/field";
import { Switch } from "@shopper/ui/components/switch";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { focusFirstInvalid } from "../../../lib/focus";
import { useSaveOnlineOrders } from "../../../queries/settings/online";
import { bufferFormSchema, type OnlineSettingsView } from "../../../schemas/settings/online";
import { TextField } from "../../fields/text";
import { SaveBar } from "../page";

const stamp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Accra",
});

/**
 * The box's Online Orders switch: when on, the box keeps Shopper's online store up to date with this catalogue
 * (prices, names, what is listed and how much is left). Below it, how the last update went and what is kept back.
 */
export function OnlineOrdersCard({ settings }: { settings: OnlineSettingsView }) {
  const online = useOnline();
  const save = useSaveOnlineOrders();
  const checked = save.isPending ? save.variables.onlineOrders : settings.onlineOrders;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Online orders</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Field orientation="horizontal">
          <Switch
            id="online-orders"
            checked={checked}
            disabled={!online || save.isPending}
            aria-describedby="online-orders-status"
            onCheckedChange={(next) => save.mutate({ onlineOrders: next })}
          />
          <FieldContent>
            <FieldLabel htmlFor="online-orders">Sell online from this box</FieldLabel>
            <FieldDescription id="online-orders-status" role="status">
              {status(settings, checked)}
            </FieldDescription>
          </FieldContent>
        </Field>
        {checked && settings.error && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden />
            <AlertDescription>
              {settings.error} The box tries again by itself and after every catalogue change.
            </AlertDescription>
          </Alert>
        )}
        {settings.onlineOrders && <BufferForm buffer={settings.buffer} save={save} />}
      </CardContent>
    </Card>
  );
}

/**
 * Units of every product the online store leaves for the shelf, so a busy day in store never oversells online. It
 * shares the switch's save, so it waits while the switch is saving and never turns ordering back on behind it.
 */
function BufferForm({
  buffer,
  save,
}: {
  buffer: number;
  save: ReturnType<typeof useSaveOnlineOrders>;
}) {
  const online = useOnline();
  const form = useForm({
    defaultValues: { buffer: String(buffer) },
    validators: { onSubmit: bufferFormSchema },
    onSubmit: ({ value }) => {
      if (!save.isPending) save.mutate({ onlineOrders: true, buffer: Number(value.buffer) });
    },
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !save.isPending) void form.handleSubmit();
    },
  });
  return (
    <form
      ref={shortcuts}
      noValidate
      className="flex flex-col gap-4 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="buffer">
        {(field) => (
          <TextField
            field={field}
            label="Keep back from the online store"
            description="Units of every product left off the online store, so in-store sales never oversell it."
            inputMode="numeric"
            autoComplete="off"
            className="max-w-32"
            onChange={() => save.isError && save.reset()}
          />
        )}
      </form.Field>
      <SaveBar label="Save" pending={save.isPending} error={save.error?.message} />
    </form>
  );
}

function status(settings: OnlineSettingsView, on: boolean) {
  if (!on) return "Off. Your online store does not change while this is off.";
  if (settings.error) return "On, but the last update did not reach Shopper.";
  if (!settings.publishedAt) return "On. Sending your catalogue to the online store…";
  return `On. The online store was last updated ${stamp.format(new Date(settings.publishedAt))}.`;
}
