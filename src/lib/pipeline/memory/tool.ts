import type { ToolDefinition } from "@/lib/agent/types";

export const WORKING_MEMORY_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "update_working_memory",
    description: `MANDATORY: You MUST call this tool at the end of EVERY response to persist your current state. If you completed a step, mark it "done". If you started work, update the summary. Never finish a response without calling this tool — your memory resets between turns, so any progress not saved here is lost.`,
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description:
            "One-line current status shown to user (e.g. 'Implemented auth middleware, testing next')",
        },
        detail: {
          type: "string",
          description:
            "Expanded context you'll need next turn: decisions made, blockers, what to do next",
        },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              status: { type: "string", enum: ["done", "active", "pending"] },
            },
            required: ["name", "status"],
          },
          description:
            'Task steps with status. Mark completed steps as "done". Once defined, step names are locked until all are done.',
        },
        history: {
          type: "array",
          items: { type: "string" },
          description:
            "Append-only log — add a short line for each action you completed this turn",
        },
      },
      required: ["summary", "detail"],
    },
  },
};
