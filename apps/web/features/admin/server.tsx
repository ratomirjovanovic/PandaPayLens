import "server-only";
import { AuthzError } from "@/lib/admin/authz";
import { getDb } from "@/lib/admin/db";
import { currentPrincipal } from "@/lib/admin/request";

export async function panelCtx() {
  return { db: getDb(), principal: await currentPrincipal() };
}

/** Runs a service call for a page and renders a message if access is denied. */
export async function guarded<T>(
  fn: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; view: React.ReactNode }> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AuthzError) {
      return {
        ok: false,
        view: (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-fg-muted">
            {e.code === "FORBIDDEN"
              ? "This page is available to superadmins only."
              : "Verify with your passkey to view this page."}
          </p>
        ),
      };
    }
    throw e;
  }
}

export const fmt = (d: Date | null | undefined) =>
  d ? d.toISOString().replace("T", " ").slice(0, 19) + "Z" : "-";

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-fg-muted">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="px-3 py-6 text-center text-fg-muted">
                Nothing here yet.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-b border-border last:border-0 align-top">
                {r.map((c, j) => (
                  <td key={j} className="px-3 py-2">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PageTitle({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {lead && <p className="mt-1 text-sm text-fg-muted">{lead}</p>}
    </header>
  );
}
