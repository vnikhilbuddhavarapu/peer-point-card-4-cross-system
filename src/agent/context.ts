import type { ContextConfig } from "agents/context";

const QUESTION =
  "Which enterprise-plan customers filed tickets about the thing changed in last week's production config push?";

export function createCompositionStrategy(): string {
  // WORKSHOP TASK: Define the cross-system lookup order, join keys, and stop conditions.
  return `Inspect the connected MCP catalog and gather relevant records from multiple systems.
Use recordFinding for candidate relationships.`;
}

export function createFinalAnswerPolicy(): string {
  // WORKSHOP TASK: Define the provenance required before presenting a grounded answer.
  return `Treat a candidate as unverified unless recordFinding returns ok: true.
If no candidate is verified, explain that the evidence composition is incomplete instead of guessing.`;
}

export function createContextBlocks(): ContextConfig[] {
  const soul = `You are the Peer Point Cross-System Agent. Answer this question: ${QUESTION}

${createCompositionStrategy()}

${createFinalAnswerPolicy()}`;

  return [
    { label: "soul", provider: { get: () => Promise.resolve(soul) } },
    { label: "memory", description: "Durable cross-system join notes.", maxTokens: 1_000 },
  ];
}
