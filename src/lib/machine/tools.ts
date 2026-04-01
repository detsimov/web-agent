import type { ToolDefinition } from "@/lib/agent/types";

export const START_MACHINE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "start_machine",
    description:
      "Start a structured workflow machine on this branch. The machine enforces phases (e.g., planning → execution → validation → done) with validated transitions and per-state tool gating. Provide the definition ID and optional initial data.",
    parameters: {
      type: "object",
      properties: {
        definitionId: {
          type: "string",
          description:
            "The ID of the machine definition to start (e.g., 'planning')",
        },
        data: {
          type: "object",
          description:
            "Optional initial data for the machine instance (e.g., { goal: 'Implement auth' })",
        },
      },
      required: ["definitionId"],
    },
  },
};

export const TRANSITION_STATE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "transition_state",
    description:
      "Transition the active machine to a new state. The transition must be allowed by the machine definition's rules. Optionally include data to merge into state data before transitioning (e.g., save the plan when moving from planning to execution).",
    parameters: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "The target state to transition to",
        },
        reason: {
          type: "string",
          description: "Why this transition is happening",
        },
        data: {
          type: "object",
          description:
            "Optional data to merge into state data before the transition (e.g., { plan: [...] })",
        },
      },
      required: ["to", "reason"],
    },
  },
};

export const UPDATE_STATE_DATA_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "update_state_data",
    description:
      "Update the active machine instance's data with a shallow merge. Each top-level key in the provided data fully replaces the corresponding key in the instance data.",
    parameters: {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: "Data to shallow-merge into the machine instance's data",
        },
      },
      required: ["data"],
    },
  },
};

export const GET_STATE_TOOL: ToolDefinition = {
  type: "function",
  function: {
    name: "get_state",
    description:
      "Get the current machine state for this branch. Returns the active machine instance with definition metadata, or available machines if none is active.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};

export const MACHINE_TOOL_NAMES = new Set([
  "start_machine",
  "transition_state",
  "update_state_data",
  "get_state",
]);
