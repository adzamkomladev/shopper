/** The constraint text of a failed write: Drizzle wraps the driver error, so it lives on the cause. */
export async function violation(attempt: Promise<unknown>) {
  const error = await attempt.then(
    () => undefined,
    (thrown: Error & { cause?: Error }) => thrown,
  );
  return error?.cause?.message ?? error?.message;
}
