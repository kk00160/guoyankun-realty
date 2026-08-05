import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

/**
 * 告訴搜尋引擎哪些頁面可以收錄。
 * 後台與預約 API 明確排除：正式站雖已回 404，仍不希望出現在索引嘗試中。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"]
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
