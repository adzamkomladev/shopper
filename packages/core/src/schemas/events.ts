import * as v from "valibot";

const envelope = v.object({ v: v.pipe(v.number(), v.integer(), v.minValue(1)) });
export function createEventDecoder<T>(
  currentVersion: number,
  read: (raw: unknown) => T,
  upcasters: Record<number, (raw: unknown) => unknown> = {},
) {
  return (raw: unknown): T => {
    let version = v.parse(envelope, raw).v;
    if (version > currentVersion) throw new Error("Unsupported event version");
    while (version < currentVersion) {
      const upcast = upcasters[version];
      if (!upcast) throw new Error("Unsupported event version");
      raw = upcast(raw);
      if (v.parse(envelope, raw).v !== version + 1)
        throw new Error("An upcaster must advance exactly one event version");
      version += 1;
    }
    return read(raw);
  };
}
