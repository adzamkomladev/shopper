/** Why an archive cannot be imported, in words for the owner, with the HTTP status the API answers. */
export class ImportError extends Error {
  constructor(
    message: string,
    public status: 403 | 409 | 422 = 422,
  ) {
    super(message);
  }
}
