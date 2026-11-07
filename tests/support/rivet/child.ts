// A box host in its own process for the restart test: `bun --preload ./tooling/build/bun.ts child.ts <pool> <file> [<id>]` starts the flow when an id
// is given, and every host of the pool runs it. Each step appends its name and this process id to the file.
import { appendFileSync } from "node:fs";
import * as v from "valibot";
import { rivetHost } from "@shopper/adapters-box";
import { rivetEngine } from "./engine";

const [pool, file, id] = process.argv.slice(2) as [string, string, string | undefined];
const policy = { maxAttempts: 1, delayMs: 0, backoff: "constant" } as const;
const host = rivetHost({ ...rivetEngine, pool });
const launcher = host.launch("restart", v.object({}), async (flow) => {
  await flow.step(
    "before",
    policy,
    async () => (appendFileSync(file, `before ${process.pid}\n`), null),
  );
  await flow.sleep("nap", 4_000);
  await flow.step(
    "after",
    policy,
    async () => (appendFileSync(file, `after ${process.pid}\n`), null),
  );
});
if (id) await launcher.start(id, {});
console.log("ready");
