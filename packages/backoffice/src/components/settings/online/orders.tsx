import { CircleAlertIcon } from "lucide-react";
import { Alert, AlertDescription } from "@shopper/ui/components/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@shopper/ui/components/card";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@shopper/ui/components/field";
import { Switch } from "@shopper/ui/components/switch";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { useSaveOnlineOrders } from "../../../queries/settings/online";
import type { OnlineSettingsView } from "../../../schemas/settings/online";

const stamp = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Accra",
});

/**
 * The box's Online Orders switch: when on, the box keeps Shopper's online store up to date with this catalogue
 * (prices, names and what is listed). Below it, how the last update went.
 */
export function OnlineOrdersCard({ settings }: { settings: OnlineSettingsView }) {
  const online = useOnline();
  const save = useSaveOnlineOrders();
  const checked = save.isPending ? save.variables : settings.onlineOrders;
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
            onCheckedChange={(next) => save.mutate(next)}
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
      </CardContent>
    </Card>
  );
}

function status(settings: OnlineSettingsView, on: boolean) {
  if (!on) return "Off. Your online store does not change while this is off.";
  if (settings.error) return "On, but the last update did not reach Shopper.";
  if (!settings.publishedAt) return "On. Sending your catalogue to the online store…";
  return `On. The online store was last updated ${stamp.format(new Date(settings.publishedAt))}.`;
}
