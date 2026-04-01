import type { ToolDefinition } from "@/lib/agent/types";
import { listMachines } from "./registry";
import {
  GET_STATE_TOOL,
  START_MACHINE_TOOL,
  TRANSITION_STATE_TOOL,
  UPDATE_STATE_DATA_TOOL,
} from "./tools";
import type {
  StateMachineDefinition,
  StateMachineInstance,
  TransitionRecord,
} from "./types";

type TransitionResult =
  | { ok: true; record: TransitionRecord }
  | { ok: false; error: string };

export function validateTransition(
  definition: StateMachineDefinition,
  instance: StateMachineInstance,
  to: string,
  reason: string,
): TransitionResult {
  if (definition.final.includes(instance.current)) {
    return {
      ok: false,
      error: `Machine is in terminal state "${instance.current}"`,
    };
  }

  if (!(to in definition.states)) {
    return { ok: false, error: `Unknown state "${to}"` };
  }

  const allowed = definition.transitions.filter(
    (t) => t.from === instance.current,
  );
  const match = allowed.find((t) => t.to === to);

  if (!match) {
    const valid = allowed
      .map((t) => `"${t.to}" (when: ${t.condition})`)
      .join(", ");
    return {
      ok: false,
      error: `Cannot transition from "${instance.current}" to "${to}". Valid transitions: ${valid}`,
    };
  }

  // Enforce required data keys
  if (match.requiredData && match.requiredData.length > 0) {
    const missing = match.requiredData.filter(
      (key) =>
        !(key in instance.data) ||
        instance.data[key] === null ||
        instance.data[key] === undefined,
    );
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Cannot transition to "${to}": missing required data keys: ${missing.join(", ")}. Call update_state_data first.`,
      };
    }
  }

  return {
    ok: true,
    record: {
      from: instance.current,
      to,
      reason,
      timestamp: new Date().toISOString(),
    },
  };
}

export function resolveTools(
  definition: StateMachineDefinition,
  instance: StateMachineInstance | null,
  allDomainTools: ToolDefinition[],
): ToolDefinition[] {
  if (!instance || instance.status !== "active") {
    return [...allDomainTools, START_MACHINE_TOOL, GET_STATE_TOOL];
  }

  const state = definition.states[instance.current];
  if (!state) {
    return [...allDomainTools, START_MACHINE_TOOL, GET_STATE_TOOL];
  }

  // Expand tool groups to get allowed tool names
  const allowedNames = new Set<string>();
  for (const groupName of state.toolGroups) {
    const group = definition.toolGroups[groupName];
    if (group) {
      for (const name of group) {
        allowedNames.add(name);
      }
    }
  }

  // Filter domain tools by allowed names
  const filtered = allDomainTools.filter((t) =>
    allowedNames.has(t.function.name),
  );

  // Add machine-specific tools for active state
  return [
    ...filtered,
    TRANSITION_STATE_TOOL,
    UPDATE_STATE_DATA_TOOL,
    GET_STATE_TOOL,
  ];
}

export function buildPromptSection(
  definition: StateMachineDefinition,
  instance: StateMachineInstance,
): string {
  const state = definition.states[instance.current];
  if (!state) return "";

  const availableTransitions = definition.transitions
    .filter((t) => t.from === instance.current)
    .map((t) => `- "${t.to}" (when: ${t.condition})`)
    .join("\n");

  const dataStr = JSON.stringify(instance.data);

  const historyStr =
    instance.history.length > 0
      ? instance.history
          .map((h) => `- ${h.from} → ${h.to}: ${h.reason} (${h.timestamp})`)
          .join("\n")
      : "None";

  return `[STATE MACHINE]
Machine: ${definition.name} (${definition.id})
Current State: ${instance.current}
Status: ${instance.status}

[Instructions]
${state.instructions}

[Available Transitions]
${availableTransitions || "None (terminal state)"}

[State Data]
${dataStr}

[Transition History]
${historyStr}`;
}

// --- buildInactivePromptSection ---

export function buildInactivePromptSection(): string {
  const machines = listMachines();
  if (machines.length === 0) return "";

  const list = machines
    .map((m) => `- "${m.id}": ${m.name} — ${m.description}`)
    .join("\n");

  return `[AVAILABLE WORKFLOWS]
You have access to structured workflow machines that enforce phases with validated transitions and per-state tool gating. When the user asks for structured planning, phased work, or step-by-step execution, start the appropriate machine using the start_machine tool.

Available machines:
${list}

To start a workflow, call: start_machine({ definitionId: "<id>", data: { goal: "<user's goal>" } })
To check current state: call get_state()`;
}

export function updateStateData(
  instance: StateMachineInstance,
  patch: Record<string, unknown>,
): StateMachineInstance {
  return {
    ...instance,
    data: { ...instance.data, ...patch },
    updatedAt: new Date(),
  };
}

export function validateDefinition(
  definition: StateMachineDefinition,
): string[] {
  const errors: string[] = [];

  // Check initial state exists
  if (!(definition.initial in definition.states)) {
    errors.push(
      `Initial state "${definition.initial}" does not exist in states`,
    );
  }

  // Check final states exist
  for (const f of definition.final) {
    if (!(f in definition.states)) {
      errors.push(`Final state "${f}" does not exist in states`);
    }
  }

  // Check transition references
  for (const t of definition.transitions) {
    if (!(t.from in definition.states)) {
      errors.push(`Transition references nonexistent "from" state "${t.from}"`);
    }
    if (!(t.to in definition.states)) {
      errors.push(`Transition references nonexistent "to" state "${t.to}"`);
    }
  }

  // Check tool group references in states
  for (const [stateName, state] of Object.entries(definition.states)) {
    for (const groupName of state.toolGroups) {
      if (!(groupName in definition.toolGroups)) {
        errors.push(
          `State "${stateName}" references nonexistent tool group "${groupName}"`,
        );
      }
    }
  }

  return errors;
}
