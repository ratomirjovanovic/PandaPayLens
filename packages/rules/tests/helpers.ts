import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { analyzeText, type AnalysisResult, type AnalyzeOptions } from "@pandapaylens/core";
import { stripeAdapter } from "@pandapaylens/stripe";
import { adyenAdapter } from "@pandapaylens/adyen";
import { defaultRules, RULE_CATALOG_VERSION } from "@pandapaylens/rules";

export const FIXED_NOW = () => new Date("2026-10-25T12:00:00.000Z");

export const options: AnalyzeOptions = {
  adapters: [stripeAdapter, adyenAdapter],
  rules: defaultRules,
  catalogVersion: RULE_CATALOG_VERSION,
  now: FIXED_NOW,
};

export function fixture(path: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../fixtures/${path}`, import.meta.url)), "utf8");
}

export function analyze(text: string, extra: Partial<AnalyzeOptions> = {}): AnalysisResult {
  const r = analyzeText(text, { ...options, ...extra });
  if (!r.ok) throw new Error(`analysis failed: ${r.error.code} ${r.error.message}`);
  return r.result;
}

export const analyzeFixture = (path: string, extra?: Partial<AnalyzeOptions>) =>
  analyze(fixture(path), extra);

export const ruleIds = (r: AnalysisResult) => r.findings.map((f) => f.ruleId).sort();
