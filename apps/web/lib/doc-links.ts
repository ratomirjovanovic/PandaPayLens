import { MANIFESTS } from "@pandapaylens/providers/manifests";

const hostOf = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.hostname : null;
  } catch {
    return null;
  }
};

/** Hosts that the provider manifests themselves cite as official documentation. */
const DOC_HOSTS = new Set(
  MANIFESTS.flatMap((m) => m.documentation.map((d) => hostOf(d.url))).filter(
    (h): h is string => h !== null,
  ),
);

/** True for https links on a host a provider manifest cites as documentation. */
export function isOfficialDocUrl(url: string | undefined): url is string {
  if (!url) return false;
  const host = hostOf(url);
  return host !== null && DOC_HOSTS.has(host);
}
