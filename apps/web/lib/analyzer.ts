import {
  analyzeSources,
  redactDeep,
  type AnalysisResult,
  type SourceSummary,
  type SourceText,
} from "@pandapaylens/core";
import { ADAPTERS } from "@pandapaylens/providers";
import { defaultRules, RULE_CATALOG_VERSION } from "@pandapaylens/rules";

export { ADAPTERS };

export type AnalyzeRequest = { sources: SourceText[]; provider: string | null };

export type AnalyzeResponse =
  | {
      ok: true;
      result: AnalysisResult;
      sources: SourceSummary[];
      /** Redacted copies of the input records for the data inspector. */
      inspector: unknown[];
    }
  | { ok: false; code: string; message: string; source?: string; line?: number; column?: number };

/**
 * Runs entirely in the browser (normally inside a Web Worker). Nothing here
 * performs network requests or writes to storage.
 */
export function runAnalysis(req: AnalyzeRequest): AnalyzeResponse {
  const r = analyzeSources(req.sources, {
    adapters: ADAPTERS,
    rules: defaultRules,
    catalogVersion: RULE_CATALOG_VERSION,
    provider: req.provider,
  });
  if (!r.ok) {
    const e = r.error as {
      code: string;
      message: string;
      source?: string;
      line?: number;
      column?: number;
    };
    return {
      ok: false,
      code: e.code,
      message: e.message,
      ...(e.source ? { source: e.source } : {}),
      ...(e.line ? { line: e.line, column: e.column } : {}),
    };
  }
  return {
    ok: true,
    result: r.result,
    sources: r.sources,
    inspector: r.records.map((rec) => redactDeep(rec)),
  };
}
