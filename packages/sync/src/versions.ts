export function negotiateProtocol(current: number, requested: number): number | undefined {
  return Number.isInteger(requested) &&
    requested > 0 &&
    (requested === current || (current > 1 && requested === current - 1))
    ? requested
    : undefined;
}
