import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

/**
 * 只列出對外公開的頁面。
 * 預約系統與後台在正式站是關閉的，不放進 sitemap。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/card`, lastModified, changeFrequency: "monthly", priority: 0.8 }
  ];
}
