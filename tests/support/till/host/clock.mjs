// Preloaded into a spawned till host by the chaos suites: shifts the wall clock (Date) by an offset the
// test controls, while performance.now() stays monotonic, as on a register whose clock is set wrong.
// The offset starts from SHOPPER_TEST_CLOCK_OFFSET_MS; a `test.clock` IPC message moves it and is acked.
const RealDate = Date;
const realNow = RealDate.now.bind(RealDate);
let offset = Number(process.env.SHOPPER_TEST_CLOCK_OFFSET_MS ?? 0);

class ShiftedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(realNow() + offset);
    else super(...args);
  }
  static now() {
    return realNow() + offset;
  }
}
globalThis.Date = ShiftedDate;

process.on("message", (message) => {
  if (message?.type !== "test.clock") return;
  offset = message.offsetMs;
  process.send?.({ type: "test.clock.set", id: message.id, offsetMs: offset });
});
