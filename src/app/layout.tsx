import type { Metadata } from "next";
import { PROFILE } from "@/lib/profile";
import "./globals.css";

// 目前的正式網址。之後若買了自己的網域，改這一行即可。
const SITE_URL = "https://guoyankun.vercel.app";

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {children}
      </body>
    </html>
  );
}
