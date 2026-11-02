/** A store request naming a branch or product the shop does not have. */
export class StoreError extends Error {
  readonly status = 404;
}
