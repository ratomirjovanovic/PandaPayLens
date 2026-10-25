import { describe, expect, it } from "vitest";
import { ADAPTERS, MANIFESTS, ROADMAP } from "@pandapaylens/providers";

describe("provider registry", () => {
  it("has exactly one adapter per manifest, with matching ids and versions", () => {
    expect(ADAPTERS.map((a) => a.id)).toEqual(MANIFESTS.map((m) => m.id));
    for (const a of ADAPTERS) {
      expect(a.manifest.id).toBe(a.id);
      expect(a.manifest.version).toBe(a.version);
      expect(a.manifest.displayName).toBe(a.displayName);
    }
  });

  it("lists 22 roadmap providers with unique ids, and every manifest is on the roadmap", () => {
    expect(ROADMAP).toHaveLength(22);
    expect(new Set(ROADMAP.map((r) => r.id)).size).toBe(22);
    for (const m of MANIFESTS) expect(ROADMAP.some((r) => r.id === m.id)).toBe(true);
  });

  it("manifests are honest: supported formats match api families, docs are official https links", () => {
    for (const a of ADAPTERS) {
      const families = a.manifest.apiFamilies
        .filter((f) => f.status !== "unsupported")
        .map((f) => f.id);
      for (const f of a.supportedFormats) expect(families).toContain(f.id);
      for (const d of a.manifest.documentation) expect(d.url).toMatch(/^https:\/\//);
      expect(a.manifest.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // An adapter marked supported must not have any unsupported core capability.
      if (a.manifest.status === "supported") {
        expect(Object.values(a.manifest.capabilities)).not.toContain("unsupported");
      }
    }
  });
});
