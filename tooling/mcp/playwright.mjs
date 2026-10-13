import { spawn } from "node:child_process";

const args = ["dlx", "@playwright/mcp@0.0.83", "--headless"];
// Chromium cannot use its process sandbox when this development container runs as root.
if (process.getuid?.() === 0) args.push("--no-sandbox");
const child = spawn("vp", args, { stdio: "inherit" });
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
