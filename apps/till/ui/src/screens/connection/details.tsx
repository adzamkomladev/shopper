import type { HostStatus } from "@shopper/sync/bridge";
import { Skeleton } from "@shopper/ui/components/skeleton";
import type { HostConnection } from "../../connection/store";

export function IdentityRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="max-w-full truncate text-right text-sm font-medium">{value}</p>
    </div>
  );
}

export function IdentitySkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Skeleton className="h-5 w-32" />
    </div>
  );
}

export function hostDetail(host: HostConnection) {
  return {
    connected: "Local storage is ready",
    connecting: "Opening secure local connection",
    disconnected: "Start the host, then reconnect",
  }[host];
}

export function serverLabelFor(server: HostStatus["server"] | null) {
  return (
    {
      connecting: "Connecting",
      online: "Connected",
      offline: "Offline",
      blocked: "Upload blocked",
      revoked: "Device revoked",
      incompatible: "Version incompatible",
    }[server ?? "connecting"] ?? "Unknown status"
  );
}

export function serverState(server: HostStatus["server"] | null): "good" | "pending" | "problem" {
  if (server === "online") return "good";
  if (server === "connecting") return "pending";
  return "problem";
}

export function serverDetail(
  server: HostStatus["server"] | null,
  pending: number,
  blocked: number,
) {
  if (blocked)
    return `${blocked} rejected sale${blocked === 1 ? " remains" : "s remain"} saved. Ask a manager to investigate.`;
  if (pending) return `${pending} sale${pending === 1 ? " is" : "s are"} waiting to upload`;
  if (server === "offline") return "Sales are saved here while the server is offline";
  if (server === "revoked") return "This device needs to be enrolled again";
  if (server === "incompatible") return "Update the register application to continue";
  if (server === "blocked") return "Ask a manager to investigate the rejected sale";
  if (server === "online") return "No sales are waiting to upload";
  if (!server) return "Connect this register host to check the server";
  return "Checking the server connection";
}

export function errorTitle(server: HostStatus["server"] | null, host: HostConnection) {
  if (server === "revoked") return "Register access was revoked";
  if (server === "incompatible") return "Register version is not supported";
  if (server === "blocked") return "A sale needs attention";
  if (server === "offline") return "Server is unavailable";
  return host === "disconnected" ? "Host connection is unavailable" : "Connection needs attention";
}
