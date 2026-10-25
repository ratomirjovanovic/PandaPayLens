import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXIT, run, stripControl } from "../src/cli.js";

const fixtures = fileURLToPath(new URL("../../../fixtures/", import.meta.url));

function exec(args: string[], stdin = "") {
  let out = "";
  let err = "";
  const code = run(args, {
    stdout: (s) => (out += s),
    stderr: (s) => (err += s),
    readStdin: () => stdin,
    readFile: (p) => readFileSync(p.startsWith("fx:") ? fixtures + p.slice(3) : p, "utf8"),
    color: false,
  });
  return { code, out, err };
}

describe("cli", () => {
  it("prints help and fails without a command", () => {
    expect(exec([]).code).toBe(EXIT.INVALID_INPUT);
    const h = exec(["--help"]);
    expect(h.code).toBe(EXIT.OK);
    expect(h.out).toMatch(/Exit codes/);
  });

  it("prints versions", () => {
    expect(exec(["version"]).out).toMatch(/rule catalog 2026\.10\.0/);
  });

  it("lists providers as text and JSON", () => {
    expect(exec(["providers"]).out).toMatch(/adyen\.webhook\.standard/);
    const all = JSON.parse(exec(["providers", "-f", "json"]).out) as {
      id: string;
      status: string;
    }[];
    expect(all).toHaveLength(42);
    const available = JSON.parse(exec(["providers", "--supported", "-f", "json"]).out) as {
      id: string;
    }[];
    expect(available.map((p) => p.id)).toEqual(expect.arrayContaining(["stripe", "adyen"]));
    expect(available.every((p) => all.some((a) => a.id === p.id && a.status !== "planned"))).toBe(
      true,
    );
  });

  it("analyzes a file and masks identifiers by default", () => {
    const r = exec(["analyze", "fx:stripe/successful-payment.json"]);
    expect(r.code).toBe(EXIT.OK);
    expect(r.out).toMatch(/payment_intent\.succeeded/);
    expect(r.out).not.toContain("pi_3PPLsynthOK000001");
    expect(r.out).toContain("pi_••••0001");
  });

  it("includes identifiers on request", () => {
    expect(
      exec(["analyze", "fx:stripe/successful-payment.json", "--include-identifiers"]).out,
    ).toContain("pi_3PPLsynthOK000001");
  });

  it("reads stdin", () => {
    const r = exec(
      ["decode", "-"],
      readFileSync(`${fixtures}stripe/insufficient-funds.json`, "utf8"),
    );
    expect(r.code).toBe(EXIT.OK);
    expect(r.out).toMatch(/insufficient_funds/);
    expect(r.out).not.toMatch(/Timeline/);
  });

  it("timeline mode omits errors and findings", () => {
    const r = exec(["timeline", "fx:adyen/authorisation-and-capture.json"]);
    expect(r.out).toMatch(/CAPTURE/);
    expect(r.out).not.toMatch(/Findings/);
  });

  it("does not fail on a payment failure unless asked", () => {
    expect(exec(["analyze", "fx:adyen/declined-authorisation.json"]).code).toBe(EXIT.OK);
    expect(exec(["analyze", "fx:adyen/declined-authorisation.json", "--fail-on", "low"]).code).toBe(
      EXIT.FINDINGS,
    );
    expect(
      exec(["analyze", "fx:adyen/declined-authorisation.json", "--fail-on", "medium"]).code,
    ).toBe(EXIT.OK);
  });

  it("emits JSON and Markdown reports", () => {
    expect(JSON.parse(exec(["analyze", "fx:adyen/retry-risk.json", "-f", "json"]).out).tool).toBe(
      "PandaPayLens",
    );
    expect(exec(["analyze", "fx:adyen/retry-risk.json", "-f", "markdown"]).out).toMatch(
      /^# PandaPayLens diagnostic report/,
    );
  });

  it.each([
    [
      ["analyze", "fx:malformed/invalid-json.txt"],
      EXIT.INVALID_INPUT,
      /Invalid JSON.*line 1, column/,
    ],
    [["analyze", "missing-file.json"], EXIT.INVALID_INPUT, /File not found/],
    [["analyze"], EXIT.INVALID_INPUT, /Missing input/],
    [["analyze", "fx:malformed/unknown-provider-error.json"], EXIT.UNSUPPORTED, /^$/],
    [
      ["analyze", "fx:stripe/insufficient-funds.json", "-p", "worldpay"],
      EXIT.UNSUPPORTED,
      /Unknown provider/,
    ],
    [["analyze", "x", "--format", "pdf"], EXIT.INVALID_INPUT, /Unknown --format/],
    [["analyze", "x", "--fail-on", "severe"], EXIT.INVALID_INPUT, /Unknown --fail-on/],
    [["analyze", "x", "--bogus"], EXIT.INVALID_INPUT, /Unknown option/],
    [["frobnicate"], EXIT.INVALID_INPUT, /Unknown command/],
  ])("%j exits %i", (args, code, err) => {
    const r = exec(args as string[]);
    expect(r.code).toBe(code);
    expect(r.err).toMatch(err);
  });

  it("forces a provider with --provider", () => {
    const r = exec(
      ["analyze", "-", "-p", "adyen"],
      JSON.stringify({ error: { type: "card_error" } }),
    );
    expect(r.code).toBe(EXIT.UNSUPPORTED);
  });

  it("strips terminal control sequences from untrusted text", () => {
    expect(stripControl("ok\u001b[31mred\u0007‮")).toBe("ok[31mred");
    const r = exec(
      ["decode", "-"],
      JSON.stringify({
        error: { type: "card_error", code: "x\u001b]0;pwned\u0007", message: "m\u001b[2J" },
      }),
    );
    // eslint-disable-next-line no-control-regex
    expect(r.out).not.toMatch(/\u001b/);
  });
});
