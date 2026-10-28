export type RequestRecord = { path: string; request: unknown; response?: unknown; status?: number };

export type GateState = { enter(): void; wait: Promise<void>; release(): void; written(): void };

export function createGate(releaseGates: Set<() => void>) {
  let enter = () => {};
  let release = () => {};
  let written = () => {};
  const entered = new Promise<void>((resolve) => (enter = resolve));
  const wait = new Promise<void>((resolve) => (release = resolve));
  const responseWritten = new Promise<void>((resolve) => (written = resolve));
  releaseGates.add(release);
  return {
    state: { enter, wait, release, written },
    result: { entered, written: responseWritten, release },
  };
}

export function waitForRequest(
  waiters: Map<number, (request: RequestRecord) => void>,
  call: number,
  error: string,
  timeoutMs: number,
) {
  return new Promise<RequestRecord>((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(call);
      reject(new Error(`${error} within ${timeoutMs}ms`));
    }, timeoutMs);
    waiters.set(call, (request) => {
      clearTimeout(timer);
      resolve(request);
    });
  });
}

export function isPullRequest(request: RequestRecord) {
  return isPullPath(new URL(request.path, "http://localhost").pathname);
}

export function isPullPath(path: string) {
  return path === "/sync/changes" || path === "/sync/snapshot" || path === "/sync/status";
}

export function countPath(requests: RequestRecord[], path: string) {
  return requests.filter((request) => new URL(request.path, "http://localhost").pathname === path)
    .length;
}

export function countPulls(requests: RequestRecord[]) {
  return requests.filter(isPullRequest).length;
}

export function parse(body: Buffer): unknown {
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    return body.toString("utf8");
  }
}
