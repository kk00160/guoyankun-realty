import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-config";

/**
 * 告訴搜尋引擎哪些頁面可以收錄。
 * 後台與預約 API 明確排除：正式站雖已回 404，仍不希望出現在索引嘗試中。
 *
 * /tour/ 是買方的看房清單，內容是「某個買方看過哪些房子」，屬於個資，
 * 一律不讓搜尋引擎抓。頁面本身也有 noindex，兩層都留著。
 * 路徑寫在這裡不會洩漏什麼 —— 沒有那組 32 字元的 token 一樣打不開。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/tour/"]
    },
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
