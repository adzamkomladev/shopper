import { renderCheck } from "@shopper/adapters-box/renderer";
import { boxEngine } from "../engine";
import { embeddedPack } from "../pack";
import { doctorParams } from "../schemas/doctor";

const once = { maxAttempts: 1, delayMs: 0, backoff: "constant" } as const;

/**
 * `shopper-box doctor`: proves this binary's workflow engine runs a workflow to its first step, and that its receipt
 * renderer (satori and the resvg wasm) draws an image. With
 * `RIVET_ENDPOINT` that is the Rivet runner inside the binary (its native addon included); without, the in-process
 * engine. The installer runs it last, so a box that cannot run workflows never reports a finished install.
 */
export async function runDoctor(env: Record<string, string | undefined>) {
  let ping = () => {};
  const ran = new Promise<void>((resolve) => (ping = resolve));
  const launcher = boxEngine(env).launch("doctor", doctorParams, async (flow) => {
    await flow.step("ping", once, async () => (ping(), null));
  });
  await launcher.start(`doctor_${crypto.randomUUID()}`, {});
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("The workflow engine did not run a workflow in 60 s")),
      60_000,
    ),
  );
  await Promise.race([ran, timeout]);
  const wasm = (await embeddedPack())?.file("wasm/index_bg.wasm");
  const image = await renderCheck({
    wasm: wasm && (async () => new Uint8Array(await wasm.arrayBuffer())),
  });
  console.log(
    JSON.stringify({
      event: "doctor.ok",
      engine: env.RIVET_ENDPOINT ? "rivet" : "in-process",
      renderer: image > 0 ? "ok" : "empty",
    }),
  );
}
