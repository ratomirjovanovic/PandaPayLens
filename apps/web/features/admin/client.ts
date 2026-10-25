"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [magicLinkClient(), passkeyClient()],
});

export type ApiError = { code: string; message: string; requestId?: string };

/**
 * Calls the admin API. If the server asks for a fresh passkey challenge,
 * runs it and retries once.
 */
export async function adminApi<T = unknown>(
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  const send = () =>
    fetch(`/api/admin/${path}`, {
      method: init.method ?? "GET",
      headers:
        init.body !== undefined || (init.method && init.method !== "GET")
          ? { "Content-Type": "application/json" }
          : {},
      body:
        init.body !== undefined
          ? JSON.stringify(init.body)
          : init.method && init.method !== "GET"
            ? "{}"
            : undefined,
      credentials: "same-origin",
    });
  let res = await send();
  let json = (await res.json().catch(() => null)) as { data?: T; error?: ApiError } | null;
  if (
    res.status === 403 &&
    (json?.error?.code === "REAUTHENTICATION_REQUIRED" || json?.error?.code === "MFA_REQUIRED")
  ) {
    const r = await authClient.signIn.passkey();
    if (r?.error)
      return {
        ok: false,
        error: { code: "PASSKEY_FAILED", message: "Passkey verification was cancelled or failed." },
      };
    res = await send();
    json = (await res.json().catch(() => null)) as typeof json;
  }
  if (!res.ok || !json || json.error)
    return {
      ok: false,
      error: json?.error ?? { code: "HTTP_" + res.status, message: "Request failed." },
    };
  return { ok: true, data: json.data as T };
}
