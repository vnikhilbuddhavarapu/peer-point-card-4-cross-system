import { MODEL_DEFINITIONS, MODEL_IDS, type ModelId } from "@peer-point/workshop-config";
import { WorkshopShell, type ConnectionStatus } from "@peer-point/workshop-ui";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { useAgent } from "agents/react";
import { useEffect, useMemo, useState } from "react";

import type { CrossSystemAgent } from "../agent/agent.js";
import { createInitialState, type CrossSystemState } from "../agent/state.js";
import { CrossSystemDashboard } from "./components/cross-system-dashboard.js";
import { toDisplayMessages } from "./lib/messages.js";

function status(readyState: number, chatStatus: string, error: boolean): ConnectionStatus {
  if (error || chatStatus === "error") return "error";
  if (chatStatus === "submitted") return "thinking";
  if (chatStatus === "streaming") return "streaming";
  return readyState === WebSocket.OPEN ? "ready" : "connecting";
}

export function App() {
  const [state, setState] = useState<CrossSystemState>(createInitialState());
  const [model, setModel] = useState<ModelId>(MODEL_IDS[5]);
  const [input, setInput] = useState("");
  const [actionError, setActionError] = useState<string>();
  const agent = useAgent<CrossSystemAgent, CrossSystemState>({
    agent: "CrossSystemAgent",
    name: "research",
    onStateUpdate: setState,
  });
  const chat = useAgentChat({
    agent,
    body: () => ({ modelId: model }),
    syncMessagesToServer: false,
  });
  useEffect(() => setModel(state.selectedModel), [state.selectedModel]);
  const messages = useMemo(() => toDisplayMessages(chat.messages), [chat.messages]);
  const connection = status(
    agent.readyState,
    chat.status,
    Boolean(actionError ?? chat.error ?? agent.connectionError),
  );

  function connectPortal(): void {
    void agent.stub
      .connectPortal()
      .then((result) => {
        if (result.authUrl) window.open(result.authUrl, "_blank", "noopener,noreferrer");
      })
      .catch(() => setActionError("Portal connection failed."));
  }

  return (
    <WorkshopShell
      aside={
        <CrossSystemDashboard
          state={state}
          onConnectPortal={connectPortal}
          onUseDirectFallback={() => void agent.stub.connectDirectFallback()}
        />
      }
      description="Join CRM, ERP, Jira, and configuration evidence through one governed MCP Portal, with a tested direct-server fallback."
      {...(actionError === undefined ? {} : { error: actionError })}
      input={input}
      inputPlaceholder="Which enterprise customers filed tickets about last week's config push?"
      messages={messages}
      models={MODEL_DEFINITIONS}
      onInputChange={setInput}
      onModelChange={(id) => {
        setModel(id);
        void agent.stub.selectModel(id);
      }}
      onReset={() => {
        chat.clearHistory();
        void agent.stub.resetResearch();
      }}
      onStop={() => void chat.stop()}
      onSubmit={() => {
        const text = input.trim();
        if (!text) return;
        void chat.sendMessage({ text });
        setInput("");
      }}
      resetLabel="Reset research"
      selectedModel={model}
      status={connection}
      title="Cross-System Agent"
    />
  );
}
