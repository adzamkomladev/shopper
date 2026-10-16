export function negotiateProtocol(current: number, requested: number): number | undefined {
  return Number.isInteger(requested) && requested > 0 && requested === current
    ? requested
    : undefined;
}
