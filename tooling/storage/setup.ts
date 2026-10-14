import { AwsClient } from "aws4fetch";

// Development-only credentials match the isolated RustFS service; no production provisioning.
const endpoint = "http://127.0.0.1:9200";
const client = new AwsClient({
  accessKeyId: "shopper_dev_access",
  secretAccessKey: "shopper_dev_secret_at_least_32_chars",
  region: "us-east-1",
  service: "s3",
});
const bucket = "shopper-imports-dev";
const created = await client.fetch(`${endpoint}/${bucket}`, { method: "PUT" });
if (!created.ok && created.status !== 409)
  throw new Error(`RustFS bucket creation failed: ${created.status} ${await created.text()}`);
const cors = await client.fetch(`${endpoint}/${bucket}?cors`, {
  method: "PUT",
  headers: { "content-type": "application/xml" },
  body: `<CORSConfiguration><CORSRule><AllowedOrigin>http://localhost:5183</AllowedOrigin><AllowedOrigin>http://127.0.0.1:5183</AllowedOrigin><AllowedOrigin>http://localhost:5173</AllowedOrigin><AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>Content-Type</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`,
});
if (!cors.ok) throw new Error(`RustFS CORS setup failed: ${cors.status} ${await cors.text()}`);
const preflight = await fetch(`${endpoint}/${bucket}/check`, {
  method: "OPTIONS",
  headers: {
    Origin: "http://localhost:5183",
    "Access-Control-Request-Method": "PUT",
    "Access-Control-Request-Headers": "content-type",
  },
});
if (
  preflight.headers.get("access-control-allow-origin") !== "http://localhost:5183" ||
  !preflight.headers.get("access-control-allow-methods")?.includes("PUT")
)
  throw new Error("RustFS browser upload preflight failed");
console.log("RustFS private imports bucket and browser CORS are ready");
