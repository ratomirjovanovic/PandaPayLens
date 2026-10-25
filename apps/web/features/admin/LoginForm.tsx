"use client";

import { useState } from "react";
import { authClient } from "./client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const r = await authClient.signIn.magicLink({ email, callbackURL: "/admin" });
    if (r.error && r.error.status === 429) {
      setState("error");
      setMessage("Too many attempts. Wait a few minutes and try again.");
      return;
    }
    // Same message whether or not the address is an administrator.
    setState("sent");
    setMessage(
      "If this address belongs to an administrator or has an open invitation, a sign-in link is on its way. It expires in 10 minutes.",
    );
  }

  async function withPasskey() {
    setState("sending");
    const r = await authClient.signIn.passkey();
    if (r?.error) {
      setState("error");
      setMessage("Passkey sign-in failed or was cancelled.");
      return;
    }
    window.location.assign("/admin");
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <form
        onSubmit={sendLink}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      >
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-border bg-bg px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-fg disabled:opacity-60"
        >
          Email me a sign-in link
        </button>
      </form>
      <button
        type="button"
        onClick={withPasskey}
        disabled={state === "sending"}
        className="rounded-md border border-border bg-card px-4 py-2 font-medium hover:bg-bg-subtle disabled:opacity-60"
      >
        Sign in with a passkey
      </button>
      <p
        aria-live="polite"
        className={`text-sm ${state === "error" ? "text-fail" : "text-fg-muted"}`}
      >
        {message}
      </p>
    </div>
  );
}
