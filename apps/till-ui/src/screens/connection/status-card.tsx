import { CheckCircle2, CircleAlert, Cloud, LoaderCircle, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shopper/ui/components/card";
import type { ReactNode } from "react";

type StatusCardProps = {
  title: string;
  description: string;
  label: string;
  detail: string;
  state: "good" | "pending" | "problem";
  kind: "host" | "server";
  children?: ReactNode;
};

export function StatusCard(props: StatusCardProps) {
  const Icon = props.kind === "host" ? hostIcon(props.label) : Cloud;
  return (
    <Card
      role="region"
      aria-label={`${props.kind === "host" ? "Host" : "Server"} connection`}
      className="gap-4 py-4 shadow-none"
    >
      <CardHeader className="gap-1 px-5">
        <CardTitle className="text-base">{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 px-5">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">{props.detail}</p>
            </div>
          </div>
          <StatusBadge label={props.label} state={props.state} />
        </div>
        {props.children}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ label, state }: { label: string; state: StatusCardProps["state"] }) {
  const style = {
    good: "bg-success/10 text-foreground",
    pending: "bg-secondary text-secondary-foreground",
    problem: "bg-destructive/10 text-foreground",
  }[state];
  const Icon = state === "good" ? CheckCircle2 : state === "pending" ? LoaderCircle : CircleAlert;
  const iconStyle = {
    good: "text-success",
    pending: "text-muted-foreground",
    problem: "text-destructive",
  }[state];
  return (
    <Badge className={`shrink-0 gap-1.5 border-0 ${style}`}>
      <Icon aria-hidden="true" className={`size-3 ${iconStyle}`} />
      {label}
    </Badge>
  );
}

function hostIcon(label: string) {
  if (label === "Connected") return Wifi;
  if (label === "Disconnected") return WifiOff;
  return LoaderCircle;
}
