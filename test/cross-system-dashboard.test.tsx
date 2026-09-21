import { MODEL_IDS } from "@peer-point/workshop-config";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { CrossSystemState } from "../src/agent/state.js";
import { CrossSystemDashboard } from "../src/client/components/cross-system-dashboard.js";

function catalogState(): CrossSystemState {
  return {
    selectedModel: MODEL_IDS[0],
    mode: "portal",
    connectionStatus: "ready",
    authUrl: null,
    visibleServers: ["Salesforce demo", "SAP demo", "Jira demo", "Inventory demo"],
    visibleTools: [
      "salesforce_demo_tool",
      "sap_demo_tool",
      "jira_demo_tool",
      "inventory_demo_tool",
    ],
    evidence: [],
    findings: [],
    turnCount: 0,
    status: "idle",
    lastUpdatedAt: "2026-09-21T12:00:00.000Z",
  };
}

describe("CrossSystemDashboard starter", () => {
  it("keeps Portal, fallback, and the discovered MCP catalog visible", () => {
    const html = renderToStaticMarkup(
      <CrossSystemDashboard
        state={catalogState()}
        onConnectPortal={vi.fn()}
        onUseDirectFallback={vi.fn()}
      />,
    );

    expect(html).toContain("Connect Portal");
    expect(html).toContain("Use direct fallback");
    expect(html).toContain("Servers &amp; tools");
    expect(html).toContain("salesforce_demo_tool");
    expect(html).toContain("sap_demo_tool");
    expect(html).toContain("jira_demo_tool");
    expect(html).toContain("inventory_demo_tool");
  });
});
