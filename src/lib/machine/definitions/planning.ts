import type { StateMachineDefinition } from "../types";

export const planningDefinition: StateMachineDefinition = {
  id: "planning",
  name: "Planning",
  description:
    "Structured planning workflow: plan first, then execute, then validate results before completing.",
  states: {
    planning: {
      description: "Analyzing the task and creating a step-by-step plan",
      instructions: `You are in PLANNING mode. Your job is to understand the task, clarify requirements, and produce a plan.

FLOW (strictly sequential — one phase per response):

Phase 1 — CLARIFY (repeat until no questions remain):
  Ask clarifying questions and STOP. Wait for answers.
  Skip this phase only if the goal is already fully clear.

Phase 2 — PRESENT PLAN:
  - Numbered checklist of tasks
  - Minimal code sketches / pseudocode for key parts (NOT full implementation)
  - Ask: "Переходим к реализации?" and STOP. No tool calls in this phase.

Phase 3 — CONFIRM (triggered by user saying yes/да/go/погнали/etc.):
  Make exactly ONE tool call that saves the plan AND transitions in a single step:
  transition_state({ to: "execution", reason: "User confirmed", data: { plan: ["task 1", "task 2", ...] } })
  Copy the plan from your Phase 2 response into the data.plan array.
  Do NOT write any text or code — only the tool call.

CRITICAL: You MUST NOT write implementation code in planning state.`,
      toolGroups: ["read"],
    },
    execution: {
      description: "Executing the plan step by step",
      instructions: `You are in EXECUTION mode. Implement the plan step by step.

FLOW:
1. Get the plan: read "plan" from state data. If state data has no plan, find the numbered plan from the conversation history above and use that.
2. Work through tasks one by one — state which task number you are on.
3. If the plan is insufficient, transition back to 'planning' — do NOT improvise new steps.
4. When all tasks are done, ask the user: "Есть ещё правки?" and STOP. Do NOT transition yet.
5. ONLY after the user confirms no more changes → transition:
   transition_state({ to: "validation", reason: "User confirmed no more changes", data: { completedSteps: ["task 1 result", ...] } })
   If the user requests changes, apply them and ask again.

RULES:
- Stay focused on the current task. Do not jump ahead or combine tasks.
- Each response works on one task (or a small related group). Do NOT try to do everything at once.
- NEVER transition back to planning just because state data is missing the plan — use the conversation history.`,
      toolGroups: ["read", "write", "execute"],
    },
    validation: {
      description: "Verifying results against the original goal",
      instructions: `You are in VALIDATION mode. Verify the results against the original goal.

FLOW:
1. Read "plan" and "completedSteps" from state data. For each task: verify it was done correctly, mark as verified or failed.
2. If issues are found → transition back to 'execution' with a clear description of what needs fixing.
3. When all checks pass → present a summary to the user and ask: "Всё готово, завершаем?" and STOP. Do NOT transition yet.
4. ONLY after the user confirms → transition:
   transition_state({ to: "done", reason: "User confirmed completion" })

RULES:
- You can read and execute but NOT write.
- Do NOT propose new changes or improvements — only verify what was done.`,
      toolGroups: ["read", "execute"],
    },
    done: {
      description: "Workflow complete",
      instructions:
        "The workflow is complete. Provide a brief summary of what was accomplished, listing each plan step and its outcome.",
      toolGroups: [],
    },
  },
  transitions: [
    {
      from: "planning",
      to: "execution",
      condition: "Plan is finalized and ready to execute",
    },
    {
      from: "execution",
      to: "validation",
      condition: "All planned steps have been executed",
    },
    {
      from: "execution",
      to: "planning",
      condition: "Plan needs revision based on new information",
    },
    {
      from: "validation",
      to: "done",
      condition: "All checks passed and results are verified",
    },
    {
      from: "validation",
      to: "execution",
      condition: "Issues found that need to be fixed",
    },
  ],
  toolGroups: {
    read: ["search_codebase", "read_file"],
    write: ["edit_file", "create_file"],
    execute: ["run_command"],
  },
  initial: "planning",
  final: ["done"],
};
