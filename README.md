# Cross-System Agent

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)]([CARD_4_DEPLOY_URL])

Build an Agent that answers a question only after joining evidence from CRM, ERP, ticketing, and configuration inventory systems. The systems are exposed through one governed MCP Server Portal, with rate-limited direct MCP servers as the fallback.

## Learning objective

Practice MCP discovery, multi-system tool orchestration, identifier-based joins, and answer provenance. Your Agent should distinguish a supported relationship from a plausible coincidence.

## Already complete

The starter already includes:

- a deployable Vite, React, Worker, and Think application;
- Workers AI model selection through the account-local `default` AI Gateway;
- Durable Object state and the chat WebSocket;
- Portal OAuth connection and authorization UI;
- a one-click direct-server fallback;
- automatic MCP tool discovery and inclusion;
- a visible catalog of connected servers and tools;
- bounded evidence and finding state;
- safe logging, observability, and deployment configuration.

Do not rewrite the MCP connection, Worker routing, Durable Object binding, model adapter, or dashboard.

## What you build

Edit exactly these files:

1. `src/agent/context.ts`
   - Write an ID-safe composition strategy.
   - Tell the model how to move from partial records to supported relationships.
   - Define when the Agent may produce a final answer and what provenance it must include.
2. `src/agent/evidence.ts`
   - Implement `joinFinding`.
   - Confirm every claimed source/entity reference was observed in MCP evidence.
   - Return a typed failure for incomplete or conflicting joins instead of guessing.

Search for `WORKSHOP TASK` in those files. The starter returns a typed `COMPOSITION_NOT_IMPLEMENTED` result for the unfinished join; it should still start, connect, list MCP capabilities, and accept chat messages before you edit it.

## First run

Use Node.js 24 or newer and an authenticated temporary workshop account.

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Open the local URL shown by Vite. Choose **Connect Portal** and complete authorization in the new tab. If Portal authorization is unavailable, choose **Use direct fallback**. The **Servers & tools** panel should populate before you begin research.

Suggested prompt:

> Which enterprise-plan customers filed tickets about the thing changed in last week's production config push?

The unfinished starter should discover and call tools, but it must not claim a final result as grounded while `joinFinding` reports `COMPOSITION_NOT_IMPLEMENTED`.

## Contracts

`recordFinding` accepts a candidate with this shape:

```ts
{
  summary: string;
  sources: Array<{
    system: "salesforce" | "sap" | "jira" | "inventory";
    entityIds: string[];
  }>;
}
```

A candidate needs references from at least three distinct systems. `joinFinding` returns a discriminated union:

- `{ ok: true, summary, sources }` after every reference has been checked against observed evidence; or
- `{ ok: false, code, message }` when composition is unfinished or the evidence does not support the candidate.

Expected tool failures are data. Do not throw for a normal missing relationship, and never fill an identifier from model inference.

## Base checklist

- [ ] Portal or direct fallback connects.
- [ ] The dashboard displays discovered MCP servers and tools.
- [ ] The strategy narrows records with explicit shared identifiers rather than names or prose similarity.
- [ ] The Agent uses at least three systems.
- [ ] Partial findings retain source system and entity IDs.
- [ ] Unsupported joins produce a typed failure.
- [ ] The final response cites the source entity IDs behind each conclusion.
- [ ] `npm run typecheck`, `npm test`, and `npm run build` pass.

## Stretch objectives

- Add conflict handling when systems disagree.
- Render joined relationships as a compact evidence graph.
- Compare a conventional tool-call join with Code Mode after the instructor confirms Worker Loader availability.

## Shared workshop services

The instructor operates these deterministic, synthetic services:

- MCP Server Portal: `https://ppug-demo-mcp.cf.prompt2prod.dev/mcp`
- Direct fallback base: `https://peer-point-synthetic-mcp.peer-point-user-group.workers.dev`

The Portal is the primary path and is protected by Access. The direct endpoints are public, synthetic, and rate-limited. Do not add credentials to source code or browser state.

## Common failures and recovery

- **Portal remains on “Authenticating”:** finish the Access flow in the authorization tab, return to the app, and reconnect. Use the direct fallback if the instructor reports a Portal issue.
- **No tools appear:** wait for discovery, then reconnect once. Confirm the shared service health with the instructor before changing code.
- **`COMPOSITION_NOT_IMPLEMENTED`:** this is the intentional workshop state. Implement `joinFinding`; do not bypass it in the prompt.
- **Model calls only one system:** make the strategy in `context.ts` explicit about join keys and stop conditions, without hard-coding an answer.
- **A deploy uses the wrong account:** activate the `peer-point-lab` Wrangler profile at the repository root, or run `wrangler login` and select only the temporary lab account.

Reset the research session from the UI after changing composition logic so old evidence does not mask a bug.

## Deploy and demo

```bash
npm run build
npx wrangler deploy --dry-run
npm run deploy
```

After deployment, connect through Portal or use the direct fallback, show the discovered catalog, run the suggested prompt, and use the evidence panel to explain every join in the final response.

Keep these security constraints in place:

- retain the model allowlist and account-local AI Gateway;
- retain Portal Access rather than embedding an OAuth token;
- treat direct MCP URLs as fallback only;
- validate tool inputs and MCP evidence at runtime;
- never log prompts, tool payloads, credentials, or private endpoints;
- never infer a relationship without matching source identifiers.

## Start with Peer Point OS

After the Deploy to Cloudflare flow creates your repository and first deployment, give the generated Git URL to Peer Point OS with this prompt:

```text
Clone this repository in an isolated Container MCP environment. Read the complete README before editing. Run npm ci and npm run verify to establish a baseline. Implement a working Cross-System Agent using the required Cloudflare primitives and preserving its safety constraints. You may choose a different architecture from the suggested path. Run focused tests and npm run verify, inspect the diff, then push through the GitHub gatekeeper. Do not claim success until verification passes. After the push, inspect Workers Builds and give me the deployed URL and demo checklist.
```

## Start with your own IDE

```bash
npm ci
npm run verify
npm run dev
```

Before pushing or deploying:

```bash
npm run verify
```

Deploy only to the temporary lab account assigned for the event.
