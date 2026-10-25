import { XIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input";
import { Label } from "@shopper/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { commandLabel } from "../../../lib/audit/diff";
import type { AuditFacets, AuditSearch } from "../../../schemas/audit";

const ANY = "any";
export const FILTERS_ID = "audit-filter-actor";

type Props = {
  search: AuditSearch;
  facets: AuditFacets;
  onChange: (next: Partial<AuditSearch>) => void;
  onClear: () => void;
};

/** Who, what, where and when: each narrows the merged log, and lives in the address. */
export function AuditFilters({ search, facets, onChange, onClear }: Props) {
  const named = (rows: { id: string; name: string | null }[]) =>
    rows.map((row) => ({ value: row.id, label: row.name ?? row.id.slice(0, 8) }));
  const plain = (rows: string[], label = (row: string) => row) =>
    rows.map((row) => ({ value: row, label: label(row) }));
  const filtered = Object.entries(search).some(([key, value]) => key !== "entry" && value);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
      <Facet
        id={FILTERS_ID}
        label="Actor"
        value={search.actor}
        options={named(facets.actors)}
        onChange={(actor) => onChange({ actor })}
      />
      <Facet
        id="audit-filter-role"
        label="Role"
        value={search.role}
        options={plain(facets.roles)}
        onChange={(role) => onChange({ role })}
      />
      <Facet
        id="audit-filter-device"
        label="Device"
        value={search.device}
        options={named(facets.devices)}
        onChange={(device) => onChange({ device })}
      />
      <Facet
        id="audit-filter-branch"
        label="Branch"
        value={search.branch}
        options={named(facets.branches)}
        onChange={(branch) => onChange({ branch })}
      />
      <Facet
        id="audit-filter-entity"
        label="Record"
        value={search.entity}
        options={plain(facets.entities, commandLabel)}
        onChange={(entity) => onChange({ entity, entityId: undefined })}
      />
      <Facet
        id="audit-filter-command"
        label="Action"
        value={search.command}
        options={plain(facets.commands, commandLabel)}
        onChange={(command) => onChange({ command })}
      />
      <Day
        id="audit-filter-from"
        label="From"
        value={search.from}
        max={search.to}
        onChange={(from) => onChange({ from })}
      />
      <Day
        id="audit-filter-to"
        label="To"
        value={search.to}
        min={search.from}
        onChange={(to) => onChange({ to })}
      />
      {filtered && (
        <div className="flex items-end sm:col-span-2 lg:col-span-4 2xl:col-span-8">
          <Button variant="ghost" size="sm" onClick={onClear}>
            <XIcon aria-hidden />
            Clear filters
            {search.entityId && <span className="text-muted-foreground">(and the record)</span>}
          </Button>
        </div>
      )}
    </div>
  );
}

type FacetProps = {
  id: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
};

function Facet({ id, label, value, options, onChange }: FacetProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? ANY}
        onValueChange={(next) => onChange(next === ANY ? undefined : next)}
      >
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any {label.toLowerCase()}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type DayProps = {
  id: string;
  label: string;
  value?: string;
  min?: string;
  max?: string;
  onChange: (value: string | undefined) => void;
};

function Day({ id, label, value, min, max, onChange }: DayProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </div>
  );
}
