import { createBucket, rustfs } from "./buckets";

const bucket = "shopper-imports-dev";
await createBucket(bucket, [
  "http://localhost:5183",
  "http://127.0.0.1:5183",
  "http://localhost:5173",
]);
await createBucket("shopper-receipts-dev");
const preflight = await fetch(`${rustfs.endpoint}/${bucket}/check`, {
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
console.log("RustFS private imports and receipts buckets and browser CORS are ready");
