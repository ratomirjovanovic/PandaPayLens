import { CORE_VERSION } from "@pandapaylens/core";
import { RULE_CATALOG_VERSION } from "@pandapaylens/rules";
import { authorize } from "@/lib/admin/authz";
import { APP_VERSION } from "@/lib/site";
import { guarded, PageTitle, panelCtx, Table } from "@/features/admin/server";

export default async function SystemPage() {
  const ctx = await panelCtx();
  const r = await guarded(async () => authorize(ctx.principal, { role: "superadmin" }));
  if (!r.ok) return r.view;
  const env = process.env;
  // Presence only; secret values are never displayed.
  const rows: [string, string][] = [
    ["Application version", APP_VERSION],
    ["Core / catalog", `${CORE_VERSION} / ${RULE_CATALOG_VERSION}`],
    ["Deployment environment", env.VERCEL_ENV ?? env.NODE_ENV ?? "unknown"],
    ["Commit", env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? "unknown"],
    ["DATABASE_URL", env.DATABASE_URL ? "set" : "missing"],
    ["BETTER_AUTH_SECRET", env.BETTER_AUTH_SECRET ? "set" : "missing"],
    ["RESEND_API_KEY", env.RESEND_API_KEY ? "set" : "missing"],
    ["EMAIL_FROM", env.EMAIL_FROM ? "set" : "missing"],
    ["SUPERADMIN_EMAIL", env.SUPERADMIN_EMAIL ? "set" : "missing"],
    ["Runtime", `Node.js ${process.versions.node}`],
  ];
  return (
    <>
      <PageTitle title="System" lead="Deployment information. Secret values are never shown." />
      <Table head={["Item", "Value"]} rows={rows.map(([k, v]) => [k, <code key="v">{v}</code>])} />
    </>
  );
}
