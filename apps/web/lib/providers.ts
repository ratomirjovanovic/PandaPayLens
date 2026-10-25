import { MANIFESTS, ROADMAP } from "@pandapaylens/providers/manifests";
import type { DirectoryEntry } from "@/features/providers/ProviderDirectory";

/** Directory data for all roadmap providers. Uses manifests only, no adapter code. */
export function directoryEntries(): DirectoryEntry[] {
  return ROADMAP.map((r) => {
    const m = MANIFESTS.find((x) => x.id === r.id);
    return {
      id: r.id,
      displayName: m?.displayName ?? r.displayName,
      wave: r.wave,
      ...(r.note ? { note: r.note } : {}),
      status: m?.status ?? null,
      ...(m
        ? {
            version: m.version,
            capabilities: m.capabilities,
            apiFamilies: m.apiFamilies.map((f) => f.id),
            ...(m.documentation[0] ? { docsUrl: m.documentation[0].url } : {}),
          }
        : {}),
      sampleCount: m?.samples.length ?? 0,
      limitations: [...(m?.limitations ?? [])],
    };
  });
}
