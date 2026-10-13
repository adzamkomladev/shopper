import { Badge } from "@shopper/ui/components/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@shopper/ui/components/field";
import { Switch } from "@shopper/ui/components/switch";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "./permissions";

type Props = {
  value: readonly string[];
  onChange: (codes: string[]) => void;
  /** Codes this member may switch on: nobody can grant what they don't hold. */
  canGrant: ReadonlySet<string>;
  /** Codes that also work on a till. */
  tillCodes: ReadonlySet<string>;
  readOnly: boolean;
};

/** Every permission in its group, each one a switch. The role's whole matrix is one field. */
export function PermissionMatrix({ value, onChange, canGrant, tillCodes, readOnly }: Props) {
  const toggle = (code: string, on: boolean) =>
    onChange(on ? [...value, code] : value.filter((held) => held !== code));
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">Permissions marked Till also work on a till.</p>
      {PERMISSION_GROUPS.map((group) => (
        <FieldSet key={group.name}>
          <FieldLegend variant="label">{group.name}</FieldLegend>
          <div className="flex flex-col divide-y rounded-lg border">
            {group.codes.map((code) => (
              <Field key={code} orientation="horizontal" className="px-4 py-3">
                <FieldContent>
                  <FieldLabel htmlFor={`permission-${code}`}>
                    {PERMISSION_LABELS[code]}
                    {tillCodes.has(code) && <Badge variant="outline">Till</Badge>}
                  </FieldLabel>
                  <FieldDescription className="font-mono text-xs">{code}</FieldDescription>
                </FieldContent>
                <Switch
                  id={`permission-${code}`}
                  checked={value.includes(code)}
                  disabled={readOnly || !canGrant.has(code)}
                  onCheckedChange={(on) => toggle(code, on)}
                />
              </Field>
            ))}
          </div>
        </FieldSet>
      ))}
    </div>
  );
}
