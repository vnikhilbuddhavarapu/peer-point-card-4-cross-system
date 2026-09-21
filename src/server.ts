import { getAgentByName, routeAgentRequest } from "agents";

import { CrossSystemAgent } from "./agent/agent.js";
import { json } from "./shared/http.js";

export { CrossSystemAgent };

export default {
  async fetch(request, env): Promise<Response> {
    const response = await routeAgentRequest(request, env);
    if (response) return response;
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true, service: "cross-system", environment: env.ENVIRONMENT });
    }
    if (request.method === "POST" && url.pathname === "/api/connect-direct") {
      const agent = await getAgentByName(env.CROSS_SYSTEM_AGENT, "research");
      await agent.resetResearch();
      return json({ ok: true, result: await agent.connectDirectFallback() });
    }
    return json({ ok: false, error: { code: "NOT_FOUND" } }, 404);
  },
} satisfies ExportedHandler<Env>;
