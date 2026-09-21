const rawBaseUrl = process.env.BASE_URL;
if (!rawBaseUrl) throw new Error("Set BASE_URL to the deployed starter URL");

const baseUrl = new URL(rawBaseUrl);
const health = await fetch(new URL("/api/health", baseUrl));
if (!health.ok) throw new Error(`Health check failed (${String(health.status)})`);

const connection = await fetch(new URL("/api/connect-direct", baseUrl), { method: "POST" });
if (!connection.ok) {
  throw new Error(`Direct fallback connection failed (${String(connection.status)})`);
}

const payload = await connection.json();
const servers = payload?.result?.servers;
const tools = payload?.result?.tools;
if (typeof servers !== "number" || servers < 4) {
  throw new Error("Direct fallback did not expose all four MCP servers");
}
if (typeof tools !== "number" || tools < 4) {
  throw new Error("Direct fallback did not expose the expected MCP catalog");
}

console.log(JSON.stringify({ ok: true, servers, tools }, null, 2));
