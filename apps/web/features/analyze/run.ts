import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/analyzer";

/** Upper bound on one analysis; the worker is terminated if it takes longer. */
export const ANALYSIS_TIMEOUT_MS = 20_000;

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" });
    return worker;
  } catch {
    return null;
  }
}

export async function analyzeInBrowser(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const w = getWorker();
  if (!w) {
    // Fallback for environments without module workers.
    const { runAnalysis } = await import("@/lib/analyzer");
    return runAnalysis(request);
  }
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      w.terminate();
      worker = null;
      resolve({
        ok: false,
        code: "TIMEOUT",
        message: `Analysis took longer than ${ANALYSIS_TIMEOUT_MS / 1000} seconds and was stopped.`,
      });
    }, ANALYSIS_TIMEOUT_MS);
    const onMessage = (e: MessageEvent<{ id: number; response: AnalyzeResponse }>) => {
      if (e.data.id !== id) return;
      cleanup();
      resolve(e.data.response);
    };
    const onError = () => {
      cleanup();
      worker = null;
      resolve({ ok: false, code: "INTERNAL_ERROR", message: "The analysis worker failed." });
    };
    const cleanup = () => {
      clearTimeout(timer);
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
    };
    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);
    w.postMessage({ id, request });
  });
}
