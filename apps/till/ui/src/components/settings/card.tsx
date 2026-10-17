import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import { Label } from "@shopper/ui/components/label";
import { Switch } from "@shopper/ui/components/switch";

/** One settings panel: a titled region whose label names it for assistive technology. */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card aria-label={title} className="min-w-0 gap-0 rounded-lg py-0 shadow-none" role="region">
      <CardHeader className="gap-1 px-5 pt-3 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-5 pb-4">{children}</CardContent>
    </Card>
  );
}

/** A labelled switch with its explanation; the switch itself is a 44px touch target. */
export function SettingsSwitch({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground" id={`${id}-hint`}>
          {description}
        </p>
      </div>
      <Switch
        aria-describedby={`${id}-hint`}
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onChange}
        size="touch"
      />
    </div>
  );
}
