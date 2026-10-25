/// <reference lib="webworker" />
import { runAnalysis, type AnalyzeRequest } from "@/lib/analyzer";

// Analysis runs off the main thread so large imports don't freeze the UI.
// The worker has no network code; the page CSP also restricts connect-src.
self.onmessage = (event: MessageEvent<{ id: number; request: AnalyzeRequest }>) => {
  const { id, request } = event.data;
  try {
    self.postMessage({ id, response: runAnalysis(request) });
  } catch (e) {
    self.postMessage({
      id,
      response: {
        ok: false,
        code: "INTERNAL_ERROR",
        message: e instanceof Error ? e.message : "Unexpected error",
      },
    });
  }
};
