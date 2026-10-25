import { getSettings } from "@/lib/admin/services";
import { SettingForm } from "@/features/admin/Actions";
import { guarded, PageTitle, panelCtx } from "@/features/admin/server";

const HINTS: Record<string, string> = {
  "public.notice": "A short notice shown on the public site, for example a maintenance window.",
  "features.examplesVisible": "true or false.",
  "docs.extraLinks": 'A list like [{"title": "Guide", "url": "https://example.org"}], up to 10.',
  "catalog.supportedVersions": 'A list of catalog versions, for example ["2026.10.0"].',
};

export default async function SettingsPage() {
  const ctx = await panelCtx();
  const r = await guarded(() => getSettings(ctx));
  if (!r.ok) return r.view;
  const values = new Map(r.data.map((s) => [s.key, s.value]));
  return (
    <>
      <PageTitle
        title="Settings"
        lead="Only allowlisted, non-secret values. Secrets (database URL, API keys) are Vercel environment variables and cannot be edited here."
      />
      <div className="grid gap-3">
        {Object.entries(HINTS).map(([key, hint]) => (
          <SettingForm key={key} settingKey={key} initial={values.get(key) ?? null} hint={hint} />
        ))}
      </div>
    </>
  );
}
