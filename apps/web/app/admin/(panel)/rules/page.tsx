import { defaultRules, RULE_CATALOG_VERSION } from "@pandapaylens/rules";
import { listDrafts } from "@/lib/admin/services";
import { ActionButton, DraftForm } from "@/features/admin/Actions";
import { fmt, guarded, PageTitle, panelCtx, Table } from "@/features/admin/server";

export default async function RulesPage() {
  const ctx = await panelCtx();
  const r = await guarded(() => listDrafts(ctx));
  if (!r.ok) return r.view;
  const superadmin = ctx.principal!.roles.includes("superadmin");
  return (
    <>
      <PageTitle
        title="Rules"
        lead={`Published catalog ${RULE_CATALOG_VERSION} comes from Git. Drafts are proposals: approval records a decision, and publication still requires a reviewed pull request with passing CI.`}
      />
      <h2 className="mb-2 font-semibold">Published rules</h2>
      <Table
        head={["Rule", "Version", "Providers", "Description"]}
        rows={defaultRules.map((x) => [
          <code key="i">{x.id}</code>,
          x.version,
          x.providers.join(", "),
          x.description,
        ])}
      />
      <h2 className="mb-2 mt-8 font-semibold">New draft</h2>
      <DraftForm />
      <h2 className="mb-2 mt-8 font-semibold">Drafts</h2>
      <Table
        head={["Rule", "Version", "Title", "Validation", "Review", "Updated", "Actions"]}
        rows={r.data.map((d) => [
          <code key="c">{d.ruleCode}</code>,
          d.proposedVersion,
          d.draftContent.title,
          d.validationStatus,
          d.reviewStatus + (d.reviewNote ? ` (${d.reviewNote})` : ""),
          fmt(d.updatedAt),
          <div key="a" className="flex flex-wrap gap-1">
            {(d.reviewStatus === "draft" || d.reviewStatus === "rejected") &&
              d.validationStatus === "valid" && (
                <ActionButton path={`rules/drafts/${d.id}/submit`} label="Submit" />
              )}
            {superadmin && d.reviewStatus === "submitted" && (
              <>
                <ActionButton path={`rules/drafts/${d.id}/approve`} body={{}} label="Approve" />
                <ActionButton
                  path={`rules/drafts/${d.id}/reject`}
                  body={{}}
                  label="Reject"
                  danger
                />
              </>
            )}
          </div>,
        ])}
      />
    </>
  );
}
