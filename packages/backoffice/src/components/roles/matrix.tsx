import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Checkbox } from "@shopper/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@shopper/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@shopper/ui/components/input-group";
import { Kbd } from "@shopper/ui/components/kbd";
import { Switch } from "@shopper/ui/components/switch";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "../../lib/roles/permissions";

type Props = {
  value: readonly string[];
  onChange: (codes: string[]) => void;
  /** Codes this member may switch on: nobody can grant what they don't hold. */
  canGrant: ReadonlySet<string>;
  /** Codes that also work on a till. */
  tillCodes: ReadonlySet<string>;
  readOnly: boolean;
};

const FILTER_ID = "permission-filter";

/**
 * Every permission in its group, each one a switch, plus one checkbox per group for the codes shown. The filter
 * (`/`) narrows the list by name or code. The role's whole matrix is one field.
 */
export function PermissionMatrix({ value, onChange, canGrant, tillCodes, readOnly }: Props) {
  const [filter, setFilter] = useState("");
  const shortcuts = useShortcuts({ "/": () => document.getElementById(FILTER_ID)?.focus() });
  const toggle = (code: string, on: boolean) =>
    onChange(on ? [...value, code] : value.filter((held) => held !== code));
  const needle = filter.trim().toLowerCase();
  const groups = PERMISSION_GROUPS.map((group) => ({
    name: group.name,
    codes: group.codes.filter(
      (code) => code.includes(needle) || PERMISSION_LABELS[code]!.toLowerCase().includes(needle),
    ),
  })).filter((group) => group.codes.length > 0);
  return (
    <div ref={shortcuts} className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">Permissions marked Till also work on a till.</p>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id={FILTER_ID}
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Name or code"
          aria-label="Filter permissions"
        />
        <InputGroupAddon align="inline-end">
          <Kbd aria-hidden>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          No permission matches “{filter.trim()}”.
        </p>
      )}
      {groups.map((group) => {
        const grantable: string[] = group.codes.filter((code) => canGrant.has(code));
        const on = grantable.filter((code) => value.includes(code)).length;
        const every = `every-${group.name.replace(/\W+/g, "-")}`;
        return (
          <FieldSet key={group.name}>
            <FieldLegend variant="label">{group.name}</FieldLegend>
            <div className="flex flex-col divide-y rounded-lg border">
              <Field orientation="horizontal" className="bg-muted/40 px-4 py-3">
                <Checkbox
                  id={every}
                  checked={on === 0 ? false : on === grantable.length ? true : "indeterminate"}
                  disabled={readOnly || grantable.length === 0}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked === true
                        ? [...new Set([...value, ...grantable])]
                        : value.filter((code) => !grantable.includes(code)),
                    )
                  }
                />
                <FieldLabel htmlFor={every}>Every {group.name} permission</FieldLabel>
              </Field>
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
                    onCheckedChange={(checked) => toggle(code, checked)}
                  />
                </Field>
              ))}
            </div>
          </FieldSet>
        );
      })}
    </div>
  );
}
