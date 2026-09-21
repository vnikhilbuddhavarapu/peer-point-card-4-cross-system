import { modelIdSchema, type ModelId } from "@peer-point/workshop-config";
import {
  Think,
  type ChatResponseResult,
  type ToolCallContext,
  type ToolCallResultContext,
  type TurnConfig,
  type TurnContext,
  type TurnResult,
} from "@cloudflare/think";
import { callable } from "agents";
import type { ContextConfig } from "agents/context";
import { tool, type LanguageModel } from "ai";

import { createContextBlocks } from "./context.js";
import {
  boundedSummary,
  collectEntityIds,
  findingCandidateSchema,
  joinFinding,
  systemFromTool,
} from "./evidence.js";
import { createCrossSystemModel } from "./model.js";
import {
  appendEvidence,
  appendFinding,
  createInitialState,
  crossSystemStateSchema,
  incrementTurnCount,
  setConnectionStatus,
  setCrossSystemStatus,
  setMode,
  setSelectedModel,
  setVisibleCapabilities,
  type CrossSystemState,
} from "./state.js";
import { logError, logInfo } from "../shared/logger.js";

const DIRECT_SERVERS = [
  ["salesforce", "/mcp/salesforce"],
  ["sap", "/mcp/sap"],
  ["jira", "/mcp/jira"],
  ["inventory", "/mcp/inventory"],
] as const;

export class CrossSystemAgent extends Think<Env, CrossSystemState> {
  override initialState = createInitialState();
  override maxSteps = 9;
  override includeMcpTools = true;
  override waitForMcpConnections = true;
  override workspaceBash = false;
  override sendReasoning = false;
  override storeMessages = false;
  override storeTools = false;

  override getModel(): LanguageModel {
    return createCrossSystemModel(this.env, this.state.selectedModel);
  }

  override configureContext(): ContextConfig[] {
    return createContextBlocks();
  }

  override getTools() {
    return {
      recordFinding: tool({
        description:
          "Validate and persist one customer, ticket, subscription, and configuration relationship.",
        inputSchema: findingCandidateSchema,
        execute: (candidate) => {
          const result = joinFinding(candidate, this.state.evidence);
          if (result.ok) this.setState(appendFinding(this.state, result.summary));
          return result;
        },
      }),
    };
  }

  override validateStateChange(nextState: CrossSystemState): void {
    crossSystemStateSchema.parse(nextState);
  }

  @callable()
  selectModel(modelId: ModelId): ModelId {
    const selected = modelIdSchema.parse(modelId);
    this.setState(setSelectedModel(this.state, selected));
    return selected;
  }

  @callable()
  async connectPortal(): Promise<{ state: string; authUrl?: string }> {
    await this.removeAllServers();
    this.setState(setConnectionStatus(setMode(this.state, "portal"), "connecting"));
    const result = await this.addMcpServer("Peer Point Portal", this.env.MCP_PORTAL_URL, {
      id: "portal",
      transport: { type: "streamable-http" },
    });
    if (result.state === "authenticating") {
      this.setState(setConnectionStatus(this.state, "authenticating", result.authUrl));
      return { state: result.state, authUrl: result.authUrl };
    }
    this.syncCapabilities("portal");
    return { state: result.state };
  }

  @callable()
  async connectDirectFallback(): Promise<{ servers: number; tools: number }> {
    await this.removeAllServers();
    this.setState(setConnectionStatus(setMode(this.state, "direct"), "connecting"));
    for (const [id, path] of DIRECT_SERVERS) {
      await this.addMcpServer(id, new URL(path, this.env.MCP_DIRECT_BASE_URL).href, {
        id,
        transport: { type: "streamable-http" },
      });
    }
    await this.mcp.waitForConnections({ timeout: 20_000 });
    return this.syncCapabilities("direct");
  }

  @callable()
  async refreshMcpState(): Promise<{ servers: number; tools: number }> {
    await this.mcp.waitForConnections({ timeout: 10_000 });
    return this.syncCapabilities(this.state.mode);
  }

  @callable()
  async resetResearch(): Promise<CrossSystemState> {
    this.resetTurnState();
    await this.clearMessages();
    const next = createInitialState(this.state.selectedModel, this.state.mode);
    this.setState(next);
    return next;
  }

  @callable()
  getDashboardState(): CrossSystemState {
    return crossSystemStateSchema.parse(this.state);
  }

  async runSmokeTurn(input: string): Promise<TurnResult> {
    return this.runTurn({ mode: "wait", input });
  }

  override beforeTurn(ctx: TurnContext): TurnConfig {
    const model =
      ctx.body?.modelId === undefined
        ? this.state.selectedModel
        : modelIdSchema.parse(ctx.body.modelId);
    this.setState(setCrossSystemStatus(setSelectedModel(this.state, model), "researching"));
    return {
      model: createCrossSystemModel(this.env, model),
      maxSteps: this.maxSteps,
      maxOutputTokens: 700,
      sendReasoning: false,
    };
  }

  override beforeToolCall(ctx: ToolCallContext): void {
    logInfo({ event: "agent_tool", operation: "before-tool", toolName: ctx.toolName });
  }

  override afterToolCall(ctx: ToolCallResultContext): void {
    const system = systemFromTool(ctx.toolName);
    if (ctx.success && system) {
      const entityIds = collectEntityIds(ctx.output);
      if (entityIds.length > 0) {
        this.setState(
          appendEvidence(this.state, {
            system,
            tool: ctx.toolName,
            entityIds,
            summary: boundedSummary(ctx.output),
          }),
        );
      }
    }
    logInfo({
      event: "agent_tool",
      operation: "after-tool",
      outcome: ctx.toolOutput.type === "tool-result" ? "success" : "failure",
      toolName: ctx.toolName,
      durationMs: Math.round(ctx.toolExecutionMs),
    });
  }

  override onChatResponse(result: ChatResponseResult): void {
    this.setState(
      setCrossSystemStatus(
        incrementTurnCount(this.state),
        result.status === "completed" ? "complete" : "idle",
      ),
    );
  }

  override onChatError(error: unknown): unknown {
    this.setState(setCrossSystemStatus(this.state, "error"));
    logError({ event: "agent_turn", outcome: "failure", errorCode: "CHAT_FAILED" });
    return error;
  }

  private async removeAllServers(): Promise<void> {
    for (const id of Object.keys(this.getMcpServers().servers)) await this.removeMcpServer(id);
  }

  private syncCapabilities(mode: "portal" | "direct"): { servers: number; tools: number } {
    const mcp = this.getMcpServers();
    const servers = Object.values(mcp.servers).map((server) => server.name);
    const tools = mcp.tools.map((mcpTool) => mcpTool.name);
    const next = setVisibleCapabilities(
      setConnectionStatus(setMode(this.state, mode), tools.length > 0 ? "ready" : "discovering"),
      servers,
      tools,
    );
    this.setState(next);
    return { servers: servers.length, tools: tools.length };
  }
}
