import { CORE_VERSION } from "@pandapaylens/core";
import { defaultRules, RULE_CATALOG_VERSION } from "@pandapaylens/rules";
import { listProviders } from "@/lib/admin/services";
import { guarded, PageTitle, panelCtx, Table } from "@/features/admin/server";

export default async function CatalogPage() {
  const ctx = await panelCtx();
  const r = await guarded(() => listProviders(ctx));
  if (!r.ok) return r.view;
  return (
    <>
      <PageTitle
        title="Catalog"
        lead={`Rule catalog ${RULE_CATALOG_VERSION} on core ${CORE_VERSION}. Git is the source of truth for published rules.`}
      />
      <Table
        head={["Rule", "Version", "Providers"]}
        rows={defaultRules.map((x) => [
          <code key="i">{x.id}</code>,
          x.version,
          x.providers.join(", "),
        ])}
      />
      <h2 className="mb-2 mt-8 font-semibold">Provider catalog</h2>
      <Table
        head={["Code", "Name", "Status", "Formats"]}
        rows={r.data.map((p) => [
          <code key="c">{p.providerCode}</code>,
          p.displayName,
          p.status,
          p.supportedFormats.join(", "),
        ])}
      />
    </>
  );
}
