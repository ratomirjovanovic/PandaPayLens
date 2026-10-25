"use client";

import { useState } from "react";
import { authClient } from "./client";

/** Shown until the session has completed a passkey challenge. */
export function PasskeyGate({ mode, email }: { mode: "enroll" | "verify"; email: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError("");
    if (mode === "enroll") {
      const added = await authClient.passkey.addPasskey({ name: "PandaPayLens admin" });
      if (added?.error) {
        setBusy(false);
        setError("Passkey registration failed or was cancelled.");
        return;
      }
    }
    // Registration alone does not verify this session; sign in with the passkey.
    const r = await authClient.signIn.passkey();
    setBusy(false);
    if (r?.error) {
      setError("Passkey verification failed or was cancelled.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6">
      <h1 className="text-xl font-semibold">
        {mode === "enroll" ? "Register a passkey" : "Verify with your passkey"}
      </h1>
      <p className="mt-2 text-sm text-fg-muted">
        {mode === "enroll"
          ? `Signed in as ${email} by email. Administrators need a passkey as a second factor. Use your phone, a security key, or your device's built-in authenticator.`
          : "Administrative access requires a passkey check for this session."}
      </p>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="mt-4 rounded-md bg-accent px-4 py-2 font-semibold text-accent-fg disabled:opacity-60"
      >
        {mode === "enroll" ? "Register passkey" : "Verify"}
      </button>
      <p aria-live="polite" className="mt-3 text-sm text-fail">
        {error}
      </p>
      <div className="mt-4 border-t border-border pt-3">
        <SignOutButton />
      </div>
    </div>
  );
}

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        window.location.assign("/admin/login");
      }}
      className="text-sm text-fg-muted underline underline-offset-2 hover:text-fg"
    >
      Sign out
    </button>
  );
}
