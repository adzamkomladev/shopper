import { toast } from "sonner";
import { useOnline } from "@shopper/ui/hooks/use-online";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { useSetChannel } from "../../../queries/platform";
import type { Tenant } from "../../../schemas/types";

const LABELS = { pilot: "Pilot", stable: "Stable" } as const;

/** Which till release feed the shop's registers follow: pilot gets a release before stable does. */
export function ChannelSelect({ tenant }: { tenant: Tenant }) {
  const online = useOnline();
  const setChannel = useSetChannel();
  return (
    <Select
      value={tenant.updateChannel}
      disabled={!online || setChannel.isPending}
      onValueChange={(value) => {
        const channel = value as Tenant["updateChannel"];
        setChannel.mutate(
          { orgId: tenant.id, channel },
          {
            onSuccess: () => toast.success(`${tenant.name} now gets ${channel} updates`),
            onError: () => toast.error("The channel did not change. Try again."),
          },
        );
      }}
    >
      <SelectTrigger aria-label={`Till updates for ${tenant.name}`} size="sm" className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
