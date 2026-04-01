import { validateDefinition } from "../engine";
import { registerMachine } from "../registry";
import { planningDefinition } from "./planning";

// Validate and register all definitions at import time
const definitions = [planningDefinition];

for (const def of definitions) {
  const errors = validateDefinition(def);
  if (errors.length > 0) {
    console.error(`Invalid machine definition "${def.id}":`, errors.join(", "));
    throw new Error(
      `Invalid machine definition "${def.id}": ${errors.join(", ")}`,
    );
  }
  registerMachine(def);
}
