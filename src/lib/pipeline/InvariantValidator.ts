import type { Invariant } from "@/lib/repository/types";

export type Violation = {
  name: string;
  description: string;
  severity: "block" | "warn";
  promptHint: string;
};

export type RagCitationContext = {
  validCitations: Set<string>;
  hadNonEmptyRagSearch: boolean;
};

const REGEX_TIMEOUT_MS = 100;
const CITATION_PATTERN = /\[([a-z0-9-]+):([a-z0-9-]+):(\d+)\]/gi;

export class InvariantValidator {
  private warnedIds = new Set<string>();

  constructor(private invariants: Invariant[]) {}

  check(
    accumulatedText: string,
    ragContext?: RagCitationContext,
  ): Violation | null {
    for (const inv of this.invariants) {
      if (!inv.enabled) continue;
      if (inv.severity === "warn" && this.warnedIds.has(inv.id)) continue;

      if (inv.type === "rag-citation") {
        const violation = this.checkRagCitation(
          inv,
          accumulatedText,
          ragContext,
        );
        if (violation) {
          if (inv.severity === "warn") this.warnedIds.add(inv.id);
          return violation;
        }
        continue;
      }

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

  private checkRagCitation(
    inv: Invariant,
    text: string,
    ragContext: RagCitationContext | undefined,
  ): Violation | null {
    if (!ragContext) return null;
    if (!ragContext.hadNonEmptyRagSearch) return null;

    const matches = [...text.matchAll(CITATION_PATTERN)];

    if (matches.length === 0) {
      return {
        name: "rag-citation-missing",
        description:
          "Response does not cite any of the knowledge-base results from this turn. Every factual claim sourced from rag_search must be followed by its citationId.",
        severity: inv.severity,
        promptHint: inv.promptHint,
      };
    }

    for (const m of matches) {
      const [, collectionSlug, docSlug, chunkStr] = m;
      const citationId = `${collectionSlug.toLowerCase()}:${docSlug.toLowerCase()}:${chunkStr}`;
      if (!ragContext.validCitations.has(citationId)) {
        return {
          name: "rag-citation-hallucinated",
          description: `Response contains citation id ${m[0]} that was not returned by any rag_search call in this turn.`,
          severity: inv.severity,
          promptHint: inv.promptHint,
        };
      }
    }

    return null;
  }
}
