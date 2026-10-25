import { listReleases } from "@/lib/admin/services";
import { fmt, guarded, PageTitle, panelCtx, Table } from "@/features/admin/server";

export default async function ReleasesPage() {
  const ctx = await panelCtx();
  const r = await guarded(() => listReleases(ctx));
  if (!r.ok) return r.view;
  return (
    <>
      <PageTitle
        title="Releases"
        lead="Catalog releases are built and published by CI from Git tags. This list is the release metadata recorded for the dashboard."
      />
      <Table
        head={["Version", "Status", "Commit", "Checksum", "Released"]}
        rows={r.data.map((x) => [
          x.version,
          x.releaseStatus,
          <code key="c">{x.gitCommitSha?.slice(0, 12) ?? "-"}</code>,
          <code key="s">{x.artifactChecksum?.slice(0, 16) ?? "-"}</code>,
          fmt(x.releasedAt),
        ])}
      />
    </>
  );
}
