export class AssetError extends Error {
  constructor(
    message: string,
    public status: 400 | 404 | 409 | 413 | 503,
  ) {
    super(message);
  }
}
