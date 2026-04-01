export type MachineStatus = "active" | "completed" | "stopped";

export type TransitionRule = {
  from: string;
  to: string;
  condition: string;
  /** Keys that must exist in instance.data before this transition is allowed */
  requiredData?: string[];
};

export type StateDefinition = {
  description: string;
  instructions: string;
  toolGroups: string[];
};

export type StateMachineDefinition = {
  id: string;
  name: string;
  description: string;
  states: Record<string, StateDefinition>;
  transitions: TransitionRule[];
  toolGroups: Record<string, string[]>;
  initial: string;
  final: string[];
};

export type TransitionRecord = {
  from: string;
  to: string;
  reason: string;
  timestamp: string;
};

export type StateMachineInstance = {
  id: number;
  branchId: number;
  definitionId: string;
  current: string;
  status: MachineStatus;
  data: Record<string, unknown>;
  history: TransitionRecord[];
  createdAt: Date;
  updatedAt: Date;
};
