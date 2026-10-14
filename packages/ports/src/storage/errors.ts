export class BlobUploadUnavailable extends Error {
  readonly name = "BlobUploadUnavailable";
  constructor() {
    super("Direct uploads require S3 object storage");
  }
}
