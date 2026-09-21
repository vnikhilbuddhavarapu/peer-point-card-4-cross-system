import type { CrossSystemState } from "../../agent/state.js";

interface CrossSystemDashboardProps {
  state: CrossSystemState;
  onConnectPortal: () => void;
  onUseDirectFallback: () => void;
}

type UnknownRecord = Record<string, unknown>;

type SourceDefinition = {
  key: "salesforce" | "sap" | "jira" | "inventory";
  label: "Salesforce" | "SAP" | "Jira" | "Inventory";
};

const SOURCES: readonly SourceDefinition[] = [
  { key: "salesforce", label: "Salesforce" },
  { key: "sap", label: "SAP" },
  { key: "jira", label: "Jira" },
  { key: "inventory", label: "Inventory" },
];

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function asItems(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstValue(record: UnknownRecord, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function textValue(record: UnknownRecord, keys: readonly string[], fallback = ""): string {
  const value = firstValue(record, keys);
  return typeof value === "string" && value.trim() ? value : fallback;
}

function displayValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function displayLabel(value: unknown, fallback: string): string {
  const text = displayValue(value) ?? fallback;
  return text.replaceAll(/[-_]/g, " ").replace(/^\w/u, (letter) => letter.toUpperCase());
}

function compactValue(value: unknown): string | undefined {
  const displayed = displayValue(value);
  if (displayed) return displayed;
  if (value === undefined || value === null) return undefined;

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return undefined;
    return serialized.length > 320 ? `${serialized.slice(0, 317)}…` : serialized;
  } catch {
    return "Details unavailable";
  }
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function statusTone(status: unknown): "active" | "error" | "neutral" | "success" {
  const normalized = typeof status === "string" ? status.toLowerCase() : "";
  if (["connected", "ready", "complete", "completed", "success"].includes(normalized)) {
    return "success";
  }
  if (["error", "failed", "disconnected"].includes(normalized)) return "error";
  if (
    [
      "authenticating",
      "authorization-required",
      "authorizing",
      "connecting",
      "pending",
      "researching",
      "running",
      "working",
    ].includes(normalized)
  ) {
    return "active";
  }
  return "neutral";
}

function sourceFor(value: unknown): SourceDefinition | undefined {
  const record = asRecord(value);
  const source = (
    displayValue(value) ??
    textValue(record, ["source", "system", "server", "provider", "provenance"])
  )
    .toLowerCase()
    .replaceAll(/[^a-z]/g, "");
  if (source.includes("salesforce") || source === "crm") return SOURCES[0];
  if (source.includes("sap") || source === "erp") return SOURCES[1];
  if (source.includes("jira") || source.includes("ticket")) return SOURCES[2];
  if (source.includes("inventory") || source.includes("configuration") || source === "product") {
    return SOURCES[3];
  }
  return undefined;
}

function itemKey(value: unknown, index: number): string {
  const record = asRecord(value);
  return textValue(record, ["id", "name", "toolName", "serverName"], `item-${String(index)}`);
}

function ConnectionPanel({
  state,
  onConnectPortal,
  onUseDirectFallback,
}: CrossSystemDashboardProps) {
  const mode = displayValue(state.mode) ?? "portal";
  const connectionStatus = displayValue(state.connectionStatus) ?? "disconnected";
  const authUrl = safeUrl(state.authUrl);
  const isDirect = mode.toLowerCase() === "direct";
  const isConnecting = ["authenticating", "authorizing", "connecting", "pending"].includes(
    connectionStatus.toLowerCase(),
  );

  return (
    <section className="cross-panel cross-connection" aria-labelledby="cross-connection-title">
      <header className="cross-panel__header">
        <div>
          <p>MCP access</p>
          <h2 id="cross-connection-title">Server Portal</h2>
        </div>
        <span
          className={`cross-status cross-status--${statusTone(connectionStatus)}`}
          aria-live="polite"
        >
          {displayLabel(connectionStatus, "Disconnected")}
        </span>
      </header>
      <div className="cross-connection__body">
        <div className={`cross-mode cross-mode--${isDirect ? "direct" : "portal"}`}>
          <span aria-hidden="true" />
          <div>
            <strong>{isDirect ? "Direct fallback active" : "Access-protected Portal"}</strong>
            <p>
              {isDirect
                ? "Requests are using rate-limited synthetic upstreams without Portal authentication."
                : "One authenticated Portal connection provides curated tools across all four systems."}
            </p>
          </div>
        </div>
        <div className="cross-actions">
          <button type="button" onClick={onConnectPortal} disabled={isConnecting}>
            {isConnecting ? "Connecting…" : "Connect Portal"}
          </button>
          {authUrl ? (
            <a href={authUrl} target="_blank" rel="noreferrer">
              Authorize Portal
            </a>
          ) : null}
          <button className="cross-button--secondary" type="button" onClick={onUseDirectFallback}>
            Use direct fallback
          </button>
        </div>
      </div>
    </section>
  );
}

function CapabilityPanel({ servers, tools }: { servers: unknown; tools: unknown }) {
  const serverItems = asItems(servers);
  const toolItems = asItems(tools);

  return (
    <section className="cross-panel cross-capabilities" aria-labelledby="cross-capabilities-title">
      <header className="cross-panel__header">
        <div>
          <p>Discovered capabilities</p>
          <h2 id="cross-capabilities-title">Servers &amp; tools</h2>
        </div>
        <span aria-label={`${String(toolItems.length)} tools`}>{toolItems.length} tools</span>
      </header>
      <div className="cross-capability-grid">
        <div>
          <h3>Servers</h3>
          {serverItems.length === 0 ? (
            <p className="cross-empty">
              No servers discovered. Connect the Portal to load upstreams.
            </p>
          ) : (
            <ul className="cross-server-list" aria-label="Available MCP servers">
              {serverItems.map((item, index) => {
                const server = asRecord(item);
                const name =
                  displayValue(item) ??
                  textValue(server, ["name", "label", "serverName"], "Server");
                const status = textValue(server, ["status", "state"], "available");
                return (
                  <li key={`${itemKey(item, index)}-${String(index)}`}>
                    <span
                      className={`cross-dot cross-dot--${statusTone(status)}`}
                      aria-hidden="true"
                    />
                    <strong>{name}</strong>
                    <span>{displayLabel(status, "Available")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <h3>Tools</h3>
          {toolItems.length === 0 ? (
            <p className="cross-empty">No tools available yet.</p>
          ) : (
            <ul className="cross-tool-list" aria-label="Available MCP tools">
              {toolItems.map((item, index) => {
                const tool = asRecord(item);
                const name =
                  displayValue(item) ?? textValue(tool, ["name", "toolName", "label"], "Tool");
                const source =
                  sourceFor(item)?.label ??
                  textValue(tool, ["server", "source", "system"], "Portal");
                return (
                  <li key={`${itemKey(item, index)}-${String(index)}`}>
                    <code>{name}</code>
                    <span>{source}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function EvidencePanel({ evidence }: { evidence: unknown }) {
  const evidenceItems = asItems(evidence);

  return (
    <section className="cross-panel" aria-labelledby="cross-evidence-title">
      <header className="cross-panel__header">
        <div>
          <p>Source trace</p>
          <h2 id="cross-evidence-title">Evidence provenance</h2>
        </div>
        <span aria-label={`${String(evidenceItems.length)} evidence items`}>
          {evidenceItems.length}
        </span>
      </header>
      <div className="cross-evidence-grid">
        {SOURCES.map((source) => {
          const sourceEvidence = evidenceItems.filter(
            (item) => sourceFor(item)?.key === source.key,
          );
          return (
            <article className={`cross-source cross-source--${source.key}`} key={source.key}>
              <header>
                <span aria-hidden="true">{source.label.slice(0, 1)}</span>
                <h3>{source.label}</h3>
                <strong aria-label={`${String(sourceEvidence.length)} items`}>
                  {sourceEvidence.length}
                </strong>
              </header>
              {sourceEvidence.length === 0 ? (
                <p className="cross-empty">No evidence collected.</p>
              ) : (
                <ul>
                  {sourceEvidence.map((item, index) => {
                    const record = asRecord(item);
                    const title = textValue(
                      record,
                      ["title", "label", "tool", "recordType", "type"],
                      `Evidence ${String(index + 1)}`,
                    );
                    const detail =
                      compactValue(
                        firstValue(record, [
                          "summary",
                          "detail",
                          "fact",
                          "value",
                          "result",
                          "data",
                        ]),
                      ) ??
                      compactValue(item) ??
                      "Evidence recorded";
                    const reference = displayValue(
                      firstValue(record, ["recordId", "ticketId", "contractId", "productId", "id"]),
                    );
                    const entityIds = asItems(record.entityIds)
                      .map((entityId) => displayValue(entityId))
                      .filter((entityId): entityId is string => entityId !== undefined);
                    const references = reference ? [reference, ...entityIds] : entityIds;
                    return (
                      <li key={`${itemKey(item, index)}-${String(index)}`}>
                        <strong>{title}</strong>
                        <p>{detail}</p>
                        {references.length > 0 ? (
                          <div className="cross-source__references" aria-label="Source record IDs">
                            {[...new Set(references)].map((itemReference) => (
                              <code key={itemReference}>{itemReference}</code>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FindingsPanel({ findings, status }: { findings: unknown; status: unknown }) {
  const findingItems = asItems(findings);
  const statusText = displayValue(status) ?? "idle";

  return (
    <section className="cross-panel cross-findings" aria-labelledby="cross-findings-title">
      <header className="cross-panel__header">
        <div>
          <p>Grounded response</p>
          <h2 id="cross-findings-title">Answer findings</h2>
        </div>
        <span className={`cross-status cross-status--${statusTone(statusText)}`} aria-live="polite">
          {displayLabel(statusText, "Idle")}
        </span>
      </header>
      {findingItems.length === 0 ? (
        <p className="cross-empty">
          No findings yet. Ask a question that requires records from multiple systems.
        </p>
      ) : (
        <ol>
          {findingItems.map((item, index) => {
            const finding = asRecord(item);
            const title = textValue(
              finding,
              ["title", "label", "question"],
              `Finding ${String(index + 1)}`,
            );
            const answer =
              displayValue(item) ??
              compactValue(
                firstValue(finding, ["answer", "summary", "finding", "detail", "value"]),
              ) ??
              "Finding recorded";
            const sources = asItems(firstValue(finding, ["sources", "systems", "provenance"]))
              .map((source) => displayValue(source) ?? sourceFor(source)?.label)
              .filter((source): source is string => Boolean(source));

            return (
              <li key={`${itemKey(item, index)}-${String(index)}`}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <article>
                  <h3>{title}</h3>
                  <p>{answer}</p>
                  {sources.length > 0 ? (
                    <ul aria-label="Finding sources">
                      {sources.map((source) => (
                        <li key={source}>{source}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function CrossSystemDashboard({
  state,
  onConnectPortal,
  onUseDirectFallback,
}: CrossSystemDashboardProps) {
  const stateRecord = asRecord(state);
  const servers = firstValue(stateRecord, ["visibleServers", "servers"]);
  const tools = firstValue(stateRecord, ["visibleTools", "tools"]);

  return (
    <div className="cross-dashboard">
      <ConnectionPanel
        state={state}
        onConnectPortal={onConnectPortal}
        onUseDirectFallback={onUseDirectFallback}
      />
      <CapabilityPanel servers={servers} tools={tools} />
      <EvidencePanel evidence={state.evidence} />
      <FindingsPanel findings={state.findings} status={state.status} />
    </div>
  );
}
