import type { StateMachineDefinition } from "./types";

const definitions = new Map<string, StateMachineDefinition>();

export function registerMachine(definition: StateMachineDefinition): void {
  definitions.set(definition.id, definition);
}

export function getMachine(
  definitionId: string,
): StateMachineDefinition | undefined {
  return definitions.get(definitionId);
}

export function listMachines(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return [...definitions.values()].map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
  }));
}
