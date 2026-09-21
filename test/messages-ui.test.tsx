import type { UIMessage } from "ai";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ToolCallCard } from "@peer-point/workshop-ui";

import { toDisplayMessages } from "../src/client/lib/messages.js";

describe("Cross-System Agent message UI", () => {
  it("strips complete and split think blocks without dropping visible text", () => {
    const messages: UIMessage[] = [
      {
        id: "message-1",
        role: "assistant",
        parts: [
          { type: "text", text: "Prefix <THINK>private reasoning" },
          { type: "text", text: "continues</think> Grounded answer" },
          { type: "text", text: "</think>Final sentence" },
          { type: "reasoning", text: "also hidden", state: "done" },
        ],
      },
    ];

    expect(toDisplayMessages(messages)).toEqual([
      {
        id: "message-1",
        role: "assistant",
        parts: [
          { type: "text", text: "Prefix" },
          { type: "text", text: "Grounded answer" },
          { type: "text", text: "Final sentence" },
        ],
      },
    ]);
  });

  it("drops messages containing only leaked reasoning", () => {
    const messages: UIMessage[] = [
      {
        id: "message-2",
        role: "assistant",
        parts: [{ type: "text", text: "<think>private chain of thought</think>" }],
      },
    ];

    expect(toDisplayMessages(messages)).toEqual([]);
  });

  it("projects cross-system tool provenance into the shared disclosure UI", () => {
    const messages: UIMessage[] = [
      {
        id: "message-3",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "jira_get_ticket",
            toolCallId: "tool-1",
            state: "output-available",
            input: { ticketId: "OPS-300" },
            output: {
              source: "Jira",
              recordId: "OPS-300",
              summary: "Provisioning failed during rollout",
            },
          },
        ],
      },
    ];

    const toolPart = toDisplayMessages(messages)[0]?.parts[0];
    expect(toolPart).toEqual({
      type: "tool",
      toolName: "jira_get_ticket",
      state: "output",
      summary: "Tool completed",
      input: { ticketId: "OPS-300" },
      output: {
        source: "Jira",
        recordId: "OPS-300",
        summary: "Provisioning failed during rollout",
      },
    });
    if (!toolPart || toolPart.type !== "tool") throw new Error("Expected a projected tool part");

    const html = renderToStaticMarkup(<ToolCallCard part={toolPart} />);
    expect(html).toContain("<details");
    expect(html).not.toContain("<details open");
    expect(html).toContain("Input");
    expect(html).toContain("Result");
    expect(html).toContain("Jira");
    expect(html).toContain("OPS-300");
  });

  it("maps Portal tool failures while preserving safe user text", () => {
    const messages: UIMessage[] = [
      {
        id: "message-4",
        role: "user",
        parts: [{ type: "text", text: "Check this customer across all systems" }],
      },
      {
        id: "message-5",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "salesforce_get_account",
            toolCallId: "tool-2",
            state: "output-error",
            input: { accountId: "ACC-100" },
            errorText: "Portal authorization required",
          },
        ],
      },
    ];

    expect(toDisplayMessages(messages)[0]?.parts).toEqual([
      { type: "text", text: "Check this customer across all systems" },
    ]);
    expect(toDisplayMessages(messages)[1]?.parts[0]).toMatchObject({
      type: "tool",
      toolName: "salesforce_get_account",
      state: "error",
    });
  });
});
