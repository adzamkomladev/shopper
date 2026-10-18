export type ShellView = "dashboard" | "sale" | "inventory" | "reports" | "purchases" | "settings";
export type LinkState = "good" | "pending" | "problem";
export type ShellLink = { label: string; state: LinkState; online: boolean };
