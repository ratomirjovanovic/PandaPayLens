import catalog from "@pandapaylens/fixtures/samples.json";

export type Sample = {
  id: string;
  title: string;
  provider: string | null;
  file: string;
  description: string;
};

export const SAMPLES: Sample[] = catalog;

/**
 * Loads a synthetic example from this site's own /samples folder (copied from
 * /fixtures at build time). Only same-origin requests, and only for examples.
 */
export async function loadSample(id: string): Promise<string | null> {
  if (!SAMPLES.some((s) => s.id === id) || !/^[a-z0-9-]+$/.test(id)) return null;
  const res = await fetch(`/samples/${id}.txt`, { cache: "force-cache" });
  if (!res.ok) return null;
  const text = await res.text();
  // Pretty-print JSON examples for readability; keep other formats as they are.
  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
  } catch {
    return text;
  }
}
