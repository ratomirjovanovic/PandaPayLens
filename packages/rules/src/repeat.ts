import type { NormalizedEvent } from "@pandapaylens/core";

/**
 * Key for "the same observation": the adapter's delivery key, or, when the
 * provider sends no delivery id, identical record content.
 */
export function repeatKey(e: NormalizedEvent): string | undefined {
  if (e.deliveryKey) return `${e.provider}:key:${e.deliveryKey}`;
  if (e.contentFingerprint) return `${e.provider}:content:${e.contentFingerprint}`;
  return undefined;
}
