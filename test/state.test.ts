import { describe, expect, it } from "vitest";

import {
  appendEvidence,
  createInitialState,
  crossSystemStateSchema,
  setConnectionStatus,
  setMode,
  setVisibleCapabilities,
} from "../src/agent/state.js";

describe("cross-system starter state", () => {
  it("starts disconnected without credentials or fabricated evidence", () => {
    const state = createInitialState();

    expect(crossSystemStateSchema.parse(state)).toMatchObject({
      mode: "portal",
      connectionStatus: "disconnected",
      authUrl: null,
      visibleServers: [],
      visibleTools: [],
      evidence: [],
      findings: [],
    });
    expect(crossSystemStateSchema.safeParse({ ...state, accessToken: "secret" }).success).toBe(
      false,
    );
  });

  it("retains the discovered Portal or direct MCP catalog", () => {
    const portal = setConnectionStatus(
      createInitialState(),
      "authenticating",
      "https://portal.example.test/authorize",
    );
    const direct = setVisibleCapabilities(
      setConnectionStatus(setMode(portal, "direct"), "ready"),
      ["Salesforce demo", "SAP demo", "Jira demo", "Inventory demo"],
      ["salesforce_demo_tool", "sap_demo_tool", "jira_demo_tool", "inventory_demo_tool"],
    );

    expect(portal.authUrl).toBe("https://portal.example.test/authorize");
    expect(direct).toMatchObject({
      mode: "direct",
      connectionStatus: "ready",
      authUrl: null,
    });
    expect(direct.visibleServers).toHaveLength(4);
    expect(direct.visibleTools).toHaveLength(4);
  });

  it("records generic provenance without encoding a worked answer", () => {
    const state = appendEvidence(createInitialState(), {
      system: "jira",
      tool: "jira_demo_lookup",
      entityIds: ["DEMO-TICKET-1", "DEMO-CUSTOMER-1"],
      summary: "A deterministic synthetic record used only to test the public contract.",
    });

    expect(state.evidence).toHaveLength(1);
    expect(state.evidence[0]).toMatchObject({
      system: "jira",
      entityIds: ["DEMO-TICKET-1", "DEMO-CUSTOMER-1"],
    });
  });
});
