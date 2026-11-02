import { useState } from "react";
import * as v from "valibot";
import { v7 } from "uuid";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { add, formatGHS, fromDecimal, money, sub, type Money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input";
import { DatePicker } from "@shopper/ui/components/picker/date";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { shopToday } from "../../../lib/tax/dates";
import { usePostJournal } from "../../../queries/ledger/books";
import { cediText } from "../../../schemas/ledger/forms";
import type { ChartRow } from "../../../schemas/ledger/views";
import { AccountForm } from "../../customers/account/shell";

type Props = {
  accounts: ChartRow[];
  lockedThrough: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
};

type Line = { key: string; accountId: string; debit: string; credit: string };
const blank = (): Line => ({ key: v7(), accountId: "", debit: "", credit: "" });
const amount = (text: string): Money =>
  text && v.is(cediText, text) ? fromDecimal(text) : money(0);

/** A hand-written entry: two or more lines on open accounts, posted only once debits equal credits. */
export function JournalEditor({ accounts, lockedThrough, ...dialog }: Props) {
  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogContent
        className="sm:max-w-3xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          dialog.restoreFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>New journal entry</DialogTitle>
          <DialogDescription>
            For what the tills cannot post: owner's money in, bank charges, accruals or corrections.
          </DialogDescription>
        </DialogHeader>
        <EntryForm
          accounts={accounts.filter((account) => !account.archived)}
          lockedThrough={lockedThrough}
          onPosted={() => dialog.onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({
  accounts,
  lockedThrough,
  onPosted,
}: {
  accounts: ChartRow[];
  lockedThrough: string | null;
  onPosted: () => void;
}) {
  const [id] = useState(() => v7());
  const [postedOn, setPostedOn] = useState(shopToday());
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState([blank(), blank()]);
  const post = usePostJournal(onPosted);
  const debits = lines.reduce((sum, line) => add(sum, amount(line.debit)), money(0));
  const credits = lines.reduce((sum, line) => add(sum, amount(line.credit)), money(0));
  const used = lines.filter((line) => amount(line.debit) !== 0 || amount(line.credit) !== 0);
  const difference = sub(debits, credits);
  const locked = !!lockedThrough && postedOn <= lockedThrough;
  const problem = !memo.trim()
    ? "Say what the entry is for."
    : used.length < 2
      ? "An entry needs two or more lines with an amount."
      : used.some(
            (line) => !line.accountId || (amount(line.debit) !== 0 && amount(line.credit) !== 0),
          )
        ? "Each line needs an account and either a debit or a credit."
        : difference !== 0
          ? `Debits and credits differ by ${formatGHS(money(Math.abs(difference)))}.`
          : locked
            ? `The books are locked through ${lockedThrough}. Pick a later day.`
            : undefined;
  const change = (key: string, patch: Partial<Line>) => {
    if (post.isError) post.reset();
    setLines((all) => all.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };
  const addLine = () => setLines((all) => [...all, blank()]);
  const shortcuts = useShortcuts({ "Alt+L": addLine });
  const submit = () =>
    post.mutate({
      id,
      postedOn,
      memo: memo.trim(),
      lines: used.map((line) => ({
        accountId: line.accountId,
        amount: sub(amount(line.debit), amount(line.credit)),
      })),
    });
  return (
    <div ref={shortcuts}>
      <AccountForm
        onSubmit={submit}
        label="Post entry"
        pending={post.isPending}
        error={post.error?.message}
        blocked={problem}
      >
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <Field>
            <FieldLabel htmlFor="entry-day">Date</FieldLabel>
            <DatePicker
              id="entry-day"
              value={postedOn}
              onValueChange={(value) => value && setPostedOn(value)}
              className="w-44"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="entry-memo">What it is for</FieldLabel>
            <Input
              id="entry-memo"
              value={memo}
              autoFocus
              autoComplete="off"
              onChange={(event) => setMemo(event.target.value)}
            />
          </Field>
        </div>
        <ul aria-label="Lines" className="flex flex-col gap-2">
          {lines.map((line, index) => (
            <li
              key={line.key}
              className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]"
            >
              <Select
                value={line.accountId}
                onValueChange={(accountId) => change(line.key, { accountId })}
              >
                <SelectTrigger
                  aria-label={`Line ${index + 1} account`}
                  className="col-span-2 w-full sm:col-span-1"
                >
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(["debit", "credit"] as const).map((side) => (
                <Input
                  key={side}
                  aria-label={`Line ${index + 1} ${side}`}
                  placeholder={side === "debit" ? "Debit" : "Credit"}
                  inputMode="decimal"
                  autoComplete="off"
                  className="text-right tabular-nums"
                  value={line[side]}
                  aria-invalid={!!line[side] && !v.is(cediText, line[side])}
                  onChange={(event) => change(line.key, { [side]: event.target.value })}
                />
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove line ${index + 1}`}
                disabled={lines.length <= 2}
                onClick={() => setLines((all) => all.filter((other) => other.key !== line.key))}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" aria-keyshortcuts="Alt+L" onClick={addLine}>
            <PlusIcon aria-hidden />
            Add line
          </Button>
          <dl className="flex gap-6 text-sm tabular-nums" aria-live="polite">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Debits</dt>
              <dd className="font-medium">{formatGHS(debits)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Credits</dt>
              <dd className="font-medium">{formatGHS(credits)}</dd>
            </div>
          </dl>
        </div>
      </AccountForm>
    </div>
  );
}
