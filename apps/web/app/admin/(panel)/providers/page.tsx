import { ADAPTERS } from "@/lib/analyzer";
import { listProviders } from "@/lib/admin/services";
import { guarded, PageTitle, panelCtx, Table } from "@/features/admin/server";

export default async function ProvidersPage() {
  const ctx = await panelCtx();
  const r = await guarded(() => listProviders(ctx));
  if (!r.ok) return r.view;
  return (
    <>
      <PageTitle
        title="Providers"
        lead="Adapters are code: changes require source review and deployment. This page shows what is deployed and the catalog metadata."
      />
      <Table
        head={["Provider", "Deployed adapter", "Supported formats", "Catalog status"]}
        rows={ADAPTERS.map((a) => [
          a.displayName,
          a.version,
          <ul key="f" className="font-mono text-xs">
            {a.supportedFormats.map((f) => (
              <li key={f.id}>{f.id}</li>
            ))}
          </ul>,
          r.data.find((p) => p.providerCode === a.id)?.status ?? "not in catalog",
        ])}
      />
    </>
  );
}
