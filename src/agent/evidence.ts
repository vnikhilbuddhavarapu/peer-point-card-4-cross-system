import { z } from "zod";

import {
  evidenceRecordSchema,
  evidenceSystemSchema,
  type EvidenceRecord,
  type EvidenceSystem,
} from "./state.js";

const ID_KEYS = new Set([
  "customerId",
  "subscriptionId",
  "contractId",
  "productId",
  "ticketId",
  "pushId",
]);

export const sourceReferenceSchema = z
  .object({
    system: evidenceSystemSchema,
    entityIds: z.array(z.string().trim().min(1).max(100)).min(1).max(24),
  })
  .strict();
export type SourceReference = z.infer<typeof sourceReferenceSchema>;

export const findingCandidateSchema = z
  .object({
    summary: z.string().trim().min(1).max(1_000),
    sources: z
      .array(sourceReferenceSchema)
      .min(3)
      .max(4)
      .refine(
        (sources) => new Set(sources.map(({ system }) => system)).size === sources.length,
        "Each source system may appear only once",
      ),
  })
  .strict();
export type FindingCandidate = z.infer<typeof findingCandidateSchema>;

export const findingJoinResultSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      summary: z.string().trim().min(1).max(1_000),
      sources: z.array(sourceReferenceSchema).min(3).max(4),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      code: z.enum(["COMPOSITION_NOT_IMPLEMENTED", "EVIDENCE_NOT_OBSERVED"]),
      message: z.string().trim().min(1).max(300),
    })
    .strict(),
]);
export type FindingJoinResult = z.infer<typeof findingJoinResultSchema>;

export function systemFromTool(toolName: string): EvidenceSystem | null {
  for (const system of ["salesforce", "sap", "jira", "inventory"] as const) {
    if (toolName.includes(system)) return system;
  }
  return null;
}

export function collectEntityIds(value: unknown): string[] {
  const ids = new Set<string>();
  function visit(item: unknown): void {
    if (Array.isArray(item)) {
      for (const child of item) visit(child);
      return;
    }
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      if (ID_KEYS.has(key) && typeof child === "string") ids.add(child);
      else visit(child);
    }
  }
  visit(value);
  return [...ids].slice(0, 24);
}

export function boundedSummary(value: unknown): string {
  const serialized = JSON.stringify(value) ?? "MCP tool returned structured evidence.";
  return serialized.slice(0, 1_000);
}

export function joinFinding(
  untrustedCandidate: unknown,
  untrustedEvidence: readonly EvidenceRecord[],
): FindingJoinResult {
  findingCandidateSchema.parse(untrustedCandidate);
  z.array(evidenceRecordSchema).parse(untrustedEvidence);

  // WORKSHOP TASK: Match every candidate source and entity ID to observed evidence.
  // Return EVIDENCE_NOT_OBSERVED for a normal unsupported join, or the validated
  // candidate as ok: true only when all required relationships are grounded.
  return {
    ok: false,
    code: "COMPOSITION_NOT_IMPLEMENTED",
    message: "Implement the evidence join before presenting grounded findings.",
  };
}
