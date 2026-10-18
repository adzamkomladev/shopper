import type { ReactNode } from "react";
import { CircleCheck, Lock } from "lucide-react";
import { add, formatGHS, money } from "@shopper/money";

const seal = "flex size-40 items-center justify-center rounded-full";
const stack = "flex flex-1 flex-col items-center justify-center gap-10 px-20 text-center";

export function DisplayIdle({ storeName }: { storeName: string | null }) {
  return (
    <div className={stack}>
      <div className={`${seal} bg-muted text-6xl font-bold text-muted-foreground`} aria-hidden>
        {storeName?.charAt(0).toUpperCase()}
      </div>
      <h1 className="flex max-w-full flex-col items-center gap-4 leading-none">
        {storeName ? (
          <>
            <span className="text-4xl font-semibold tracking-tight text-muted-foreground">
              Welcome to
            </span>
            <span className="max-w-full truncate text-7xl font-bold tracking-tight">
              {storeName}
            </span>
          </>
        ) : (
          <span className="text-7xl font-bold tracking-tight">Welcome</span>
        )}
      </h1>
    </div>
  );
}

export function DisplayPaid({ total, change }: { total: number; change: number }) {
  return (
    <div className={`${stack} gap-12`}>
      <div className={`${seal} bg-success/10 text-success`} aria-hidden>
        <CircleCheck className="size-24" strokeWidth={1} />
      </div>
      <h1 className="text-7xl leading-none font-bold tracking-tight">Thank you</h1>
      <div className="flex gap-8 leading-none">
        <Amount label="Paid" value={formatGHS(add(money(total), money(change)))} />
        {change > 0 ? <Amount label="Change due" value={formatGHS(money(change))} due /> : null}
      </div>
    </div>
  );
}

export function DisplayClosed({ storeName }: { storeName: string | null }) {
  return (
    <div className={stack}>
      <div className={`${seal} bg-muted text-muted-foreground`} aria-hidden>
        <Lock className="size-20" strokeWidth={1} />
      </div>
      <h1 className="text-7xl leading-none font-bold tracking-tight">Register closed</h1>
      <p className="text-3xl leading-none font-medium tracking-tight text-muted-foreground">
        Please use another register.{storeName ? ` Thank you for shopping at ${storeName}.` : ""}
      </p>
    </div>
  );
}

function Amount({ label, value, due }: { label: string; value: ReactNode; due?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-3xl px-16 py-10 ${due ? "bg-primary text-primary-foreground" : "border bg-card"}`}
    >
      <p className={`text-4xl font-semibold tracking-tight ${due ? "" : "text-muted-foreground"}`}>
        {label}
      </p>
      <p className="text-6xl font-bold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
