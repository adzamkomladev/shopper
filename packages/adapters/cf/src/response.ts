export function cloudflareResponse(response: Response) {
  if (!response.headers.has("content-encoding")) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    encodeBody: "manual",
  });
}
