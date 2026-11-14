/** Why an archive cannot be imported, in words for the owner, with the HTTP status the API answers. */
export class ImportError extends Error {
  constructor(
    message: string,
    public status: 403 | 404 | 409 | 422 = 422,
    /** The archive files the cloud still lacks, when that is why. */
    public missing?: string[],
  ) {
    super(message);
  }
}
