import { analyzeText, type AnalyzeOptions } from "@pandapaylens/core";
import { ADAPTERS } from "@pandapaylens/providers";
import { defaultRules, RULE_CATALOG_VERSION } from "@pandapaylens/rules";

export { run, EXIT, CLI_VERSION, stripControl, type Io } from "./cli.js";
export * from "@pandapaylens/core";
export { ADAPTERS, MANIFESTS, ROADMAP, manifestFor } from "@pandapaylens/providers";
export { defaultRules, RULE_CATALOG_VERSION } from "@pandapaylens/rules";

/**
 * Analyzes pasted text (JSON, JSONL, form data, raw HTTP, XML or name: value
 * text) with every adapter and the default rules. Runs offline.
 */
export function analyze(text: string, options: Partial<AnalyzeOptions> = {}) {
  return analyzeText(text, {
    adapters: ADAPTERS,
    rules: defaultRules,
    catalogVersion: RULE_CATALOG_VERSION,
    ...options,
  });
}
