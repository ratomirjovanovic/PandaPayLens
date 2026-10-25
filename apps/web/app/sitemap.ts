import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/analyze",
    "/examples",
    "/docs",
    "/docs/providers",
    "/docs/security",
    "/changelog",
    "/about",
  ].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: "monthly",
    priority: p === "" ? 1 : 0.7,
  }));
}
