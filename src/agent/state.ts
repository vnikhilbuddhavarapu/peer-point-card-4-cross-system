import { MODEL_IDS, modelIdSchema, type ModelId } from "@peer-point/workshop-config";
import { z } from "zod";

export const VISIBLE_SERVERS_LIMIT = 8;
export const VISIBLE_TOOLS_LIMIT = 32;
export const EVIDENCE_LIMIT = 32;
export const FINDINGS_LIMIT = 16;
export const ENTITY_IDS_LIMIT = 24;
export const FINAL_ANSWER_MIN_SYSTEMS = 3;

const visibleNameSchema = z.string().trim().min(1).max(200);
export const findingSchema = z.string().trim().min(1).max(1_000);

export const crossSystemModeSchema = z.enum(["portal", "direct"]);
export type CrossSystemMode = z.infer<typeof crossSystemModeSchema>;

export const connectionStatusSchema = z.enum([
  "disconnected",
  "connecting",
  "authenticating",
  "connected",
  "discovering",
  "ready",
  "failed",
]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const crossSystemStatusSchema = z.enum([
  "idle",
  "connecting",
  "researching",
  "complete",
  "error",
]);
export type CrossSystemStatus = z.infer<typeof crossSystemStatusSchema>;

export const evidenceSystemSchema = z.enum(["salesforce", "sap", "jira", "inventory"]);
export type EvidenceSystem = z.infer<typeof evidenceSystemSchema>;

export const evidenceRecordSchema = z
  .object({
    system: evidenceSystemSchema,
    tool: visibleNameSchema,
    entityIds: z
      .array(z.string().trim().min(1).max(100))
      .min(1)
      .max(ENTITY_IDS_LIMIT)
      .refine((ids) => new Set(ids).size === ids.length, "Entity IDs must be unique"),
    summary: z.string().trim().min(1).max(1_000),
  })
  .strict();
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export const provenanceRecordSchema = evidenceRecordSchema;
export type ProvenanceRecord = EvidenceRecord;

export const finalAnswerEvidenceSchema = z
  .array(evidenceRecordSchema)
  .min(FINAL_ANSWER_MIN_SYSTEMS)
  .max(EVIDENCE_LIMIT)
  .refine(
    (records) => new Set(records.map(({ system }) => system)).size >= FINAL_ANSWER_MIN_SYSTEMS,
    `Final answer evidence must include at least ${String(FINAL_ANSWER_MIN_SYSTEMS)} systems`,
  );
export type FinalAnswerEvidence = z.infer<typeof finalAnswerEvidenceSchema>;

export const crossSystemStateSchema = z
  .object({
    selectedModel: modelIdSchema,
    mode: crossSystemModeSchema,
    connectionStatus: connectionStatusSchema,
    authUrl: z.string().trim().max(2_048).url().nullable(),
    visibleServers: z.array(visibleNameSchema).max(VISIBLE_SERVERS_LIMIT),
    visibleTools: z.array(visibleNameSchema).max(VISIBLE_TOOLS_LIMIT),
    evidence: z.array(evidenceRecordSchema).max(EVIDENCE_LIMIT),
    findings: z.array(findingSchema).max(FINDINGS_LIMIT),
    turnCount: z.number().int().nonnegative().max(1_000_000),
    status: crossSystemStatusSchema,
    lastUpdatedAt: z.string().datetime(),
  })
  .strict()
  .refine((state) => state.connectionStatus !== "authenticating" || state.authUrl !== null, {
    message: "Authenticating connections must provide an auth URL",
    path: ["authUrl"],
  });
export type CrossSystemState = z.infer<typeof crossSystemStateSchema>;

export function createInitialState(
  selectedModel: ModelId = MODEL_IDS[5],
  mode: CrossSystemMode = "portal",
): CrossSystemState {
  return crossSystemStateSchema.parse({
    selectedModel,
    mode,
    connectionStatus: "disconnected",
    authUrl: null,
    visibleServers: [],
    visibleTools: [],
    evidence: [],
    findings: [],
    turnCount: 0,
    status: "idle",
    lastUpdatedAt: new Date().toISOString(),
  });
}

function updated(state: CrossSystemState, patch: Partial<CrossSystemState>): CrossSystemState {
  return crossSystemStateSchema.parse({
    ...state,
    ...patch,
    lastUpdatedAt: new Date().toISOString(),
  });
}

function uniqueBounded(values: readonly string[], limit: number): string[] {
  return [...new Set(values)].slice(-limit);
}

export function setSelectedModel(
  state: CrossSystemState,
  selectedModel: ModelId,
): CrossSystemState {
  return updated(state, { selectedModel: modelIdSchema.parse(selectedModel) });
}

export function setMode(state: CrossSystemState, mode: CrossSystemMode): CrossSystemState {
  const parsedMode = crossSystemModeSchema.parse(mode);
  if (parsedMode === state.mode) return state;
  return updated(state, {
    mode: parsedMode,
    connectionStatus: "disconnected",
    authUrl: null,
    visibleServers: [],
    visibleTools: [],
  });
}

export function setConnectionStatus(
  state: CrossSystemState,
  connectionStatus: ConnectionStatus,
  authUrl: string | null = null,
): CrossSystemState {
  return updated(state, {
    connectionStatus: connectionStatusSchema.parse(connectionStatus),
    authUrl,
  });
}

export function setVisibleCapabilities(
  state: CrossSystemState,
  visibleServers: readonly string[],
  visibleTools: readonly string[],
): CrossSystemState {
  const servers = visibleServers.map((server) => visibleNameSchema.parse(server));
  const tools = visibleTools.map((tool) => visibleNameSchema.parse(tool));
  return updated(state, {
    visibleServers: uniqueBounded(servers, VISIBLE_SERVERS_LIMIT),
    visibleTools: uniqueBounded(tools, VISIBLE_TOOLS_LIMIT),
  });
}

function evidenceIdentity(record: EvidenceRecord): string {
  return `${record.system}\u0000${record.tool}\u0000${record.entityIds.join("\u0000")}`;
}

function evidenceKey(record: EvidenceRecord): string {
  return `${evidenceIdentity(record)}\u0000${record.summary}`;
}

export function appendEvidence(
  state: CrossSystemState,
  untrustedRecord: EvidenceRecord,
): CrossSystemState {
  const record = evidenceRecordSchema.parse(untrustedRecord);
  const identity = evidenceIdentity(record);
  const evidence = [
    ...state.evidence.filter((item) => evidenceIdentity(item) !== identity),
    record,
  ].slice(-EVIDENCE_LIMIT);
  return updated(state, { evidence });
}

export const recordEvidence = appendEvidence;

export function appendFinding(state: CrossSystemState, untrustedFinding: string): CrossSystemState {
  const finding = findingSchema.parse(untrustedFinding);
  return updated(state, {
    findings: [...state.findings.filter((item) => item !== finding), finding].slice(
      -FINDINGS_LIMIT,
    ),
  });
}

export const recordFinding = appendFinding;

export function setCrossSystemStatus(
  state: CrossSystemState,
  status: CrossSystemStatus,
): CrossSystemState {
  return updated(state, { status: crossSystemStatusSchema.parse(status) });
}

export function incrementTurnCount(state: CrossSystemState): CrossSystemState {
  return updated(state, { turnCount: state.turnCount + 1 });
}

export function assertFinalAnswerEvidence(
  state: CrossSystemState,
  untrustedEvidence: readonly EvidenceRecord[],
): FinalAnswerEvidence {
  const evidence = finalAnswerEvidenceSchema.parse(untrustedEvidence);
  const observed = new Set(state.evidence.map(evidenceKey));
  if (evidence.some((record) => !observed.has(evidenceKey(record)))) {
    throw new Error("FINAL_ANSWER_EVIDENCE_NOT_OBSERVED");
  }
  return evidence;
}
