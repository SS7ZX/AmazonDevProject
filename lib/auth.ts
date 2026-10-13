/** Constant-time-ish bearer check. If MCP_API_KEY is unset the endpoint is open (local dev). */
export function checkBearer(req: Request): boolean {
  const key = process.env.MCP_API_KEY;
  if (!key) return true;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${key}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export const unauthorized = () =>
  new Response(JSON.stringify({ error: "Missing or invalid bearer token" }), {
    status: 401,
    headers: { "content-type": "application/json", "www-authenticate": "Bearer" },
  });
