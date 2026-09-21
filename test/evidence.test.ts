import { describe, expect, it } from "vitest";

import {
  collectEntityIds,
  findingJoinResultSchema,
  joinFinding,
  systemFromTool,
} from "../src/agent/evidence.js";
import type { EvidenceRecord } from "../src/agent/state.js";

const observedEvidence: EvidenceRecord[] = [
  {
    system: "salesforce",
    tool: "salesforce_lookup_demo_account",
    entityIds: ["DEMO-CUSTOMER-1"],
    summary: "A synthetic account record was observed.",
  },
  {
    system: "sap",
    tool: "sap_lookup_demo_subscription",
    entityIds: ["DEMO-CUSTOMER-1", "DEMO-SUBSCRIPTION-1"],
    summary: "A synthetic subscription record was observed.",
  },
  {
    system: "jira",
    tool: "jira_lookup_demo_ticket",
    entityIds: ["DEMO-CUSTOMER-1", "DEMO-TICKET-1"],
    summary: "A synthetic ticket record was observed.",
  },
];

describe("cross-system evidence contracts", () => {
  it("identifies MCP systems without depending on a fixed tool prefix", () => {
    expect(systemFromTool("portal_salesforce_lookup_account")).toBe("salesforce");
    expect(systemFromTool("sap_list_subscriptions")).toBe("sap");
    expect(systemFromTool("unrelated_tool")).toBeNull();
  });

  it("collects and deduplicates supported entity ID fields", () => {
    expect(
      collectEntityIds({
        customerId: "DEMO-CUSTOMER-1",
        nested: [
          { ticketId: "DEMO-TICKET-1" },
          { customerId: "DEMO-CUSTOMER-1", ignored: "not-an-id" },
        ],
      }),
    ).toEqual(["DEMO-CUSTOMER-1", "DEMO-TICKET-1"]);
  });

  it("always returns a typed result while the workshop join is being implemented", () => {
    const result = joinFinding(
      {
        summary: "A synthetic relationship candidate.",
        sources: observedEvidence.map(({ system, entityIds }) => ({ system, entityIds })),
      },
      observedEvidence,
    );

    expect(findingJoinResultSchema.parse(result)).toEqual(result);
  });

  it("rejects malformed candidates at the tool boundary", () => {
    expect(() => joinFinding({ summary: "Missing source references", sources: [] }, [])).toThrow();
  });

  it.todo("accepts a candidate only when every source entity was observed");
  it.todo("returns EVIDENCE_NOT_OBSERVED for a well-formed but unsupported join");
});
