import type { Metadata } from "next";
import { PROFILE } from "@/lib/profile";
import { SITE_URL } from "@/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "郭彥坤｜台南房仲顧問 - 東橋重劃區資產配置＆稅務諮詢專家",
  description:
    "郭彥坤，台南市房仲顧問，專營東橋重劃區，榮獲全國第21屆金仲獎、台南市不動產經紀人公會菁英獎。提供資產配置、稅務諮詢、簡易裝潢等全方位不動產服務，可線上預約免費諮詢。",
  keywords: [
    "台南房仲",
    "東橋重劃區",
    "台南買房",
    "台南賣房",
    "資產配置",
    "不動產稅務諮詢",
    "郭彥坤",
    "金仲獎",
    "台南不動產經紀人"
  ],
  authors: [{ name: PROFILE.name }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "zh_TW",
    siteName: `${PROFILE.name} 台南房仲顧問`,
    title: "郭彥坤｜台南房仲顧問 - 東橋重劃區資產配置＆稅務諮詢專家",
    description: "全國第21屆金仲獎得主，專營台南東橋重劃區。資產配置、稅務諮詢、簡易裝潢，一站式不動產服務。",
    images: ["/guo-yankun-hero.jpg"]
  },
  twitter: {
    card: "summary_large_image",
    title: "郭彥坤｜台南房仲顧問",
    description: "專營東橋重劃區，資產配置／稅務諮詢／簡易裝潢，全國金仲獎得主。",
    images: ["/guo-yankun-hero.jpg"]
  }
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  name: PROFILE.name,
  image: `${SITE_URL}/guo-yankun-hero.jpg`,
  telephone: "+886-921-020-851",
  email: PROFILE.email,
  areaServed: { "@type": "City", name: "台南市" },
  address: {
    "@type": "PostalAddress",
    addressLocality: "台南市",
    addressRegion: "台南市",
    addressCountry: "TW"
  },
  award: ["全國第21屆金仲獎", "台南市不動產經紀人公會菁英獎"],
  makesOffer: [
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "資產配置規劃" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "不動產稅務諮詢" } },
    { "@type": "Offer", itemOffered: { "@type": "Service", name: "簡易裝潢與空間規劃" } }
  ],
  url: SITE_URL
};

/**
 * 物件照片全部直接連到來源網站的圖床（我們不轉存別人的圖）。
 *
 * 先跟這三台機器把連線握好，第一張照片就省下 DNS 查詢與 TLS 交握。
 * 實測從台南量：光是握手就要 70～105 毫秒，而且每個網域各要一次 ——
 * 一頁上同時出現 img1 與 img2 是常態，等於白等兩輪。
 * 這幾行不佔頻寬，瀏覽器只是先把水管接好。
 */
const IMAGE_HOSTS = ["https://img1.591.com.tw", "https://img2.591.com.tw", "https://img3.591.com.tw"];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        {IMAGE_HOSTS.map((host) => (
          <link key={host} rel="preconnect" href={host} crossOrigin="anonymous" />
        ))}
      </head>
      {/*
        配色掛在 body 上 = 全站同一套（2026-08-09 彥坤指定，首頁也要跟後台一致）。
        以前是後台與買方頁各自的 layout 掛，首頁刻意維持紫綠 CIS；那條規則已經作廢。

        /admin 與 /tour 的 layout 仍然各自掛著同一個 class，不要因為這裡有了就去拿掉 ——
        重複宣告同一組變數沒有任何代價，但少了它們，哪天有人改動根 layout
        就會一次弄掉所有後台與買方頁的配色，而那是客戶看得到的畫面。
      */}
      <body className="theme-latte">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
