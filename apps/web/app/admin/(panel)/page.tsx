import { CORE_VERSION } from "@pandapaylens/core";
import { RULE_CATALOG_VERSION } from "@pandapaylens/rules";
import { dashboard } from "@/lib/admin/services";
import { APP_VERSION } from "@/lib/site";
import { fmt, guarded, PageTitle, panelCtx, Table } from "@/features/admin/server";

export default async function AdminDashboard() {
  const r = await guarded(async () => dashboard(await panelCtx()));
  if (!r.ok) return r.view;
  const d = r.data;
  const stats = [
    ["Application", APP_VERSION],
    ["Core", CORE_VERSION],
    ["Rule catalog", RULE_CATALOG_VERSION],
    ["Environment", process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown"],
    ["Database", "reachable"],
    ["Admin MFA", "passkey required"],
    ["Drafts awaiting review", String(d.draftsAwaitingReview)],
    ["Failed publications", String(d.failedPublications)],
    ["Active administrators", String(d.activeAdmins)],
  ];
  return (
    <>
      <PageTitle
        title="Dashboard"
        lead="Control plane overview. This database never holds imported payment data."
      />
      <dl className="grid gap-3 sm:grid-cols-3">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <dt className="text-xs text-fg-muted">{k}</dt>
            <dd className="mt-1 font-mono text-lg">{v}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mb-2 mt-8 font-semibold">Providers</h2>
      <Table
        head={["Code", "Name", "Status"]}
        rows={d.providers.map((p) => [<code key="c">{p.code}</code>, p.name, p.status])}
      />
      <h2 className="mb-2 mt-8 font-semibold">Recent administrative actions</h2>
      <Table
        head={["Time", "Action", "Outcome"]}
        rows={d.recentActions.map((a) => [
          fmt(a.timestamp),
          <code key="a">{a.action}</code>,
          a.outcome,
        ])}
      />
    </>
  );
}
