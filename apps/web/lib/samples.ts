import catalog from "@pandapaylens/fixtures/samples.json";

export type Sample = {
  id: string;
  title: string;
  provider: string | null;
  file: string;
  description: string;
};

export const SAMPLES: Sample[] = catalog;

// Explicit loaders keep each sample in its own chunk, fetched from this site only.
const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  "stripe/successful-payment.json": () =>
    import("@pandapaylens/fixtures/stripe/successful-payment.json"),
  "stripe/insufficient-funds.json": () =>
    import("@pandapaylens/fixtures/stripe/insufficient-funds.json"),
  "stripe/authentication-required.json": () =>
    import("@pandapaylens/fixtures/stripe/authentication-required.json"),
  "stripe/duplicate-webhook.json": () =>
    import("@pandapaylens/fixtures/stripe/duplicate-webhook.json"),
  "stripe/out-of-order.json": () => import("@pandapaylens/fixtures/stripe/out-of-order.json"),
  "stripe/api-error-unknown-outcome.json": () =>
    import("@pandapaylens/fixtures/stripe/api-error-unknown-outcome.json"),
  "stripe/state-inconsistency.json": () =>
    import("@pandapaylens/fixtures/stripe/state-inconsistency.json"),
  "adyen/successful-authorisation.json": () =>
    import("@pandapaylens/fixtures/adyen/successful-authorisation.json"),
  "adyen/declined-authorisation.json": () =>
    import("@pandapaylens/fixtures/adyen/declined-authorisation.json"),
  "adyen/authorisation-and-capture.json": () =>
    import("@pandapaylens/fixtures/adyen/authorisation-and-capture.json"),
  "adyen/duplicate-and-conflict.json": () =>
    import("@pandapaylens/fixtures/adyen/duplicate-and-conflict.json"),
  "adyen/retry-risk.json": () => import("@pandapaylens/fixtures/adyen/retry-risk.json"),
  "malformed/unknown-provider-error.json": () =>
    import("@pandapaylens/fixtures/malformed/unknown-provider-error.json"),
  "mixed/unrelated-transactions.json": () =>
    import("@pandapaylens/fixtures/mixed/unrelated-transactions.json"),
};

export async function loadSample(id: string): Promise<string | null> {
  const s = SAMPLES.find((x) => x.id === id);
  const load = s ? loaders[s.file] : undefined;
  if (!load) return null;
  const mod = await load();
  return `${JSON.stringify(mod.default, null, 2)}\n`;
}
