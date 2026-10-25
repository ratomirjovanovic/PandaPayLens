import { listAuditLogs } from "@/lib/admin/services";
import { fmt, guarded, PageTitle, panelCtx, Table } from "@/features/admin/server";

export default async function AuditLogsPage() {
  const ctx = await panelCtx();
  const r = await guarded(() => listAuditLogs(ctx, { limit: 200 }));
  if (!r.ok) return r.view;
  const superadmin = ctx.principal!.roles.includes("superadmin");
  return (
    <>
      <PageTitle
        title="Audit log"
        lead={
          superadmin
            ? "Append-only record of security-relevant actions. Entries cannot be edited or deleted from the application."
            : "Your own non-security actions. Superadmins see the full log."
        }
      />
      <Table
        head={["Time", "Action", "Resource", "Outcome", "Details"]}
        rows={r.data.map((a) => [
          fmt(a.timestamp),
          <code key="a">{a.action}</code>,
          <span key="r" className="font-mono text-xs">
            {a.resourceType}
            {a.resourceId ? ` ${a.resourceId.slice(0, 8)}…` : ""}
          </span>,
          a.outcome,
          <span key="m" className="font-mono text-xs text-fg-muted">
            {a.safeMetadata ? JSON.stringify(a.safeMetadata) : ""}
          </span>,
        ])}
      />
    </>
  );
}
