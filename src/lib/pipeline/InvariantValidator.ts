import type { Invariant } from "@/lib/repository/types";

export type Violation = {
  name: string;
  description: string;
  severity: "block" | "warn";
  promptHint: string;
};

const REGEX_TIMEOUT_MS = 100;

export class InvariantValidator {
  private warnedIds = new Set<string>();

  constructor(private invariants: Invariant[]) {}

  check(accumulatedText: string): Violation | null {
    for (const inv of this.invariants) {
      if (!inv.enabled) continue;
      if (inv.severity === "warn" && this.warnedIds.has(inv.id)) continue;

      // Skip invariants without a pattern (prompt-only, no hard enforcement)
      if (!inv.type || !inv.pattern) continue;

      let matched = false;

      if (inv.type === "regex") {
        matched = this.checkRegex(inv, accumulatedText);
      } else if (inv.type === "keyword") {
        matched = this.checkKeyword(inv, accumulatedText);
      }

      if (matched) {
        if (inv.severity === "warn") {
          this.warnedIds.add(inv.id);
        }
        return {
          name: inv.name,
          description: inv.description,
          severity: inv.severity,
          promptHint: inv.promptHint,
        };
      }
    }
    return null;
  }

  reset(): void {
    this.warnedIds.clear();
  }

  private checkRegex(inv: Invariant, text: string): boolean {
    try {
      const flags = inv.caseSensitive ? "g" : "gi";
      const re = new RegExp(inv.pattern, flags);

      const start = performance.now();
      const result = re.test(text);
      const elapsed = performance.now() - start;

      if (elapsed > REGEX_TIMEOUT_MS) {
        console.warn(
          `Invariant regex '${inv.name}' took ${elapsed.toFixed(0)}ms — skipping`,
        );
        return false;
      }

      return result;
    } catch {
      console.warn(`Invalid regex for invariant '${inv.name}': ${inv.pattern}`);
      return false;
    }
  }

  private checkKeyword(inv: Invariant, text: string): boolean {
    const keywords = inv.pattern
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const haystack = inv.caseSensitive ? text : text.toLowerCase();

    for (const kw of keywords) {
      const needle = inv.caseSensitive ? kw : kw.toLowerCase();
      if (haystack.includes(needle)) return true;
    }
    return false;
  }
}
