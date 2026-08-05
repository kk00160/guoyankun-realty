import Image from "next/image";
import Topbar from "@/app/_components/Topbar";
import { BOOKING_ENABLED, BOOKING_HREF, BOOKING_LINK_PROPS } from "@/lib/feature-flags";
import { PROFILE, SOCIAL_LINKS } from "@/lib/profile";

function ContactRow({ symbol, value, href }: { symbol: string; value: string; href?: string }) {
  const content = (
    <>
      <span className="contact-symbol" aria-hidden="true">{symbol}</span>
      <span>{value}</span>
    </>
  );
  return href ? (
    <a className="contact-row" href={href}>{content}</a>
  ) : (
    <div className="contact-row">{content}</div>
  );
}

export default function CardPage() {
  return (
    <div className="site-shell">
      <Topbar />
      <main className="card-page">
        <article className="business-card">
          <div className="card-cover">{PROFILE.brand}</div>
          <div className="portrait-wrap">
            <Image
              className="portrait"
              src={PROFILE.photoUrl}
              width={150}
              height={150}
              priority
              alt={`${PROFILE.name}個人照`}
            />
          </div>
          <div className="card-copy">
            <h1>{PROFILE.name}<span className="alias">{PROFILE.alias}</span></h1>
            <div className="card-title">{PROFILE.title}</div>
            <p className="card-slogan">{PROFILE.slogan}</p>
          </div>
          <div className="card-actions">
            {BOOKING_ENABLED && (
              <a className="button" href={BOOKING_HREF} {...BOOKING_LINK_PROPS}>預約一對一諮詢</a>
            )}
            <a className="button line-button" href={PROFILE.social.line} target="_blank" rel="noreferrer">加入 LINE</a>
          </div>
          <div className="contact-list">
            <ContactRow symbol="T" value={PROFILE.phone} href={`tel:${PROFILE.phoneRaw}`} />
            <ContactRow symbol="@" value={PROFILE.email} href={`mailto:${PROFILE.email}`} />
            <ContactRow symbol="P" value={PROFILE.address} />
          </div>
          {SOCIAL_LINKS.length > 0 && (
            <div className="social-row">
              {SOCIAL_LINKS.map((item) => (
                <a key={item.label} href={item.url} target="_blank" rel="noreferrer">{item.label}</a>
              ))}
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
