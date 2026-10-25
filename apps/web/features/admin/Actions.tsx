"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi } from "./client";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(path: string, method: "POST" | "PATCH", body?: unknown) {
    setBusy(true);
    setError("");
    const r = await adminApi(path, { method, body });
    setBusy(false);
    if (!r.ok) {
      setError(r.error.message);
      return false;
    }
    router.refresh();
    return true;
  }
  return { busy, error, run };
}

export function ActionButton({
  path,
  method = "POST",
  body,
  label,
  confirm,
  danger,
}: {
  path: string;
  method?: "POST" | "PATCH";
  body?: unknown;
  label: string;
  confirm?: string;
  danger?: boolean;
}) {
  const { busy, error, run } = useAction();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={busy}
        onClick={() => (!confirm || window.confirm(confirm)) && void run(path, method, body)}
        className={`rounded border px-2 py-0.5 text-xs disabled:opacity-60 ${danger ? "border-fail/40 text-fail hover:bg-fail/10" : "border-border hover:bg-bg-subtle"}`}
      >
        {label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-fail">
          {error}
        </span>
      )}
    </span>
  );
}

export function InviteForm() {
  const { busy, error, run } = useAction();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "superadmin">("admin");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run("invitations", "POST", { email, role, expiresInHours: 72 })) setEmail("");
      }}
      className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4"
    >
      <label className="flex flex-col gap-1 text-xs font-medium">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Role
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "superadmin")}
          className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
        >
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg disabled:opacity-60"
      >
        Invite (72 h)
      </button>
      <p className="basis-full text-xs text-fg-muted">
        The invitee signs in with a magic link to this address, then registers a passkey.
        Invitations are single-use and revocable.
      </p>
      {error && (
        <p role="alert" className="basis-full text-sm text-fail">
          {error}
        </p>
      )}
    </form>
  );
}

export function DraftForm() {
  const { busy, error, run } = useAction();
  const empty = {
    providerCode: "stripe",
    ruleCode: "",
    proposedVersion: "1.0.0",
    title: "",
    description: "",
    category: "",
    severity: "info",
    documentationUrl: "",
  };
  const [f, setF] = useState(empty);
  const set =
    (k: keyof typeof empty) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF((x) => ({ ...x, [k]: e.target.value }));
  const field = "rounded-md border border-border bg-bg px-2 py-1.5 text-sm";
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run("rules/drafts", "POST", {
          providerCode: f.providerCode || null,
          ruleCode: f.ruleCode,
          proposedVersion: f.proposedVersion,
          content: {
            title: f.title,
            description: f.description,
            category: f.category,
            severity: f.severity,
            ...(f.documentationUrl ? { documentationUrl: f.documentationUrl } : {}),
          },
        });
        if (ok) setF(empty);
      }}
      className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
    >
      <label className="flex flex-col gap-1 text-xs font-medium">
        Provider
        <select value={f.providerCode} onChange={set("providerCode")} className={field}>
          <option value="stripe">Stripe</option>
          <option value="adyen">Adyen</option>
          <option value="">Provider-agnostic</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Rule code
        <input
          required
          value={f.ruleCode}
          onChange={set("ruleCode")}
          placeholder="NEW_RULE_CODE"
          className={`${field} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Version
        <input
          required
          value={f.proposedVersion}
          onChange={set("proposedVersion")}
          className={`${field} font-mono`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Severity
        <select value={f.severity} onChange={set("severity")} className={field}>
          {["info", "low", "medium", "high", "critical"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
        Title
        <input required value={f.title} onChange={set("title")} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
        Description (what it detects, evidence, limitations)
        <textarea
          required
          rows={4}
          value={f.description}
          onChange={set("description")}
          className={field}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Category
        <input value={f.category} onChange={set("category")} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium">
        Documentation URL (required for high/critical)
        <input
          type="url"
          value={f.documentationUrl}
          onChange={set("documentationUrl")}
          className={field}
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg disabled:opacity-60"
        >
          Save draft
        </button>
        {error && (
          <p role="alert" className="mt-2 text-sm text-fail">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

export function SettingForm({
  settingKey,
  initial,
  hint,
}: {
  settingKey: string;
  initial: unknown;
  hint: string;
}) {
  const { busy, error, run } = useAction();
  const [text, setText] = useState(JSON.stringify(initial ?? null, null, 2));
  const [parseError, setParseError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        let value: unknown;
        try {
          value = JSON.parse(text);
        } catch {
          setParseError("Enter a valid JSON value.");
          return;
        }
        setParseError("");
        await run("settings", "PATCH", { key: settingKey, value });
      }}
      className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        <span className="font-mono">{settingKey}</span>
        <span className="text-xs font-normal text-fg-muted">{hint}</span>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded-md border border-border bg-code px-2 py-1.5 font-mono text-xs"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded-md border border-border px-3 py-1 text-sm hover:bg-bg-subtle disabled:opacity-60"
      >
        Save
      </button>
      {(error || parseError) && (
        <p role="alert" className="text-sm text-fail">
          {parseError || error}
        </p>
      )}
    </form>
  );
}
