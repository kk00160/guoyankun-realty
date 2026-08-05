import Image from "next/image";
import Link from "next/link";
import ContactForm from "@/app/_components/ContactForm";
import { BOOKING_ENABLED, BOOKING_HREF, BOOKING_LINK_PROPS } from "@/lib/feature-flags";
import { PROFILE } from "@/lib/profile";
import { ACHIEVEMENTS, SERVICE_AREAS, SERVICES } from "@/lib/site-content";

export default function HomePage() {
  return (
    <div className="site-shell">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <Link className="landing-logo" href="/">
            {PROFILE.name}<span>・台南房仲顧問</span>
          </Link>
          <nav className="landing-links" aria-label="主要導覽">
            <a href="#service-area">服務區域</a>
            <a href="#achievements">戰績</a>
            <a href="#services">服務項目</a>
            <Link href="/card">電子名片</Link>
          </nav>
          <a className="landing-cta" href={BOOKING_HREF} {...BOOKING_LINK_PROPS}>立即預約</a>
        </div>
      </header>

      <main>
        {/* 1. 形象照與個人介紹 */}
        <section className="landing-hero">
          <div className="landing-hero-inner">
            <div className="landing-hero-text">
              <p className="hero-eyebrow">台南市 · 東橋重劃區專營</p>
              <h1>
                {PROFILE.name}
                <br />
                <span className="hero-highlight">您信賴的台南房仲顧問</span>
              </h1>
              <p className="hero-desc">
                擁有超過 9 年房地產實戰經驗，深耕台南在地市場。從買賣諮詢、資產配置到稅務規劃，
                我用專業與真誠陪您做每一個關鍵決定，致力於為客戶創造最大資產價值。
              </p>
              <div className="hero-badges">
                <span className="hero-badge">🏆 全國第 21 屆金仲獎</span>
                <span className="hero-badge">🏅 不動產經紀人公會菁英獎</span>
              </div>
              <div className="hero-actions">
                <a className="cta cta-primary" href={BOOKING_HREF} {...BOOKING_LINK_PROPS}>
                  {BOOKING_ENABLED ? "線上預約諮詢" : "加 LINE 免費諮詢"}
                </a>
                <a className="cta cta-outline" href={`tel:${PROFILE.phoneRaw}`}>
                  電話聯繫 {PROFILE.phone}
                </a>
              </div>
            </div>
            <div className="landing-hero-photo">
              {/* 去背 PNG，讓人像直接融進背景漸層，不會出現白色方塊。 */}
              <Image
                src="/guo-yankun-hero.png"
                alt={`台南房仲顧問${PROFILE.name}形象照，身穿西裝雙手交叉自信微笑`}
                width={733}
                height={1100}
                priority
              />
            </div>
          </div>
        </section>

        {/* 2. 服務區域 */}
        <section className="landing-section area-section" id="service-area">
          <div className="landing-section-inner">
            <p className="section-eyebrow">SERVICE AREA</p>
            <h2>服務區域</h2>
            <p className="section-lead">
              深耕台南在地市場，主力經營<strong>東橋重劃區</strong>，具備精準的區域行情分析能力與第一手市場洞察力。
            </p>
            <div className="area-grid">
              <div className="area-main">
                <span className="area-tag">主打區域</span>
                <h3>東橋重劃區</h3>
                <p>
                  長期蹲點研究東橋重劃區房價趨勢、建案規劃與生活機能發展，掌握每一筆成交行情第一手資訊，
                  為您提供最精準的區域價值判斷。
                </p>
              </div>
              <div className="area-list">
                <h3>台南市各區服務範圍</h3>
                <ul className="chip-list">
                  {SERVICE_AREAS.map((area) => (
                    <li key={area}>{area}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 戰績 */}
        <section className="landing-section achieve-section" id="achievements">
          <div className="landing-section-inner">
            <p className="section-eyebrow">ACHIEVEMENTS</p>
            <h2>我的戰績</h2>
            <p className="section-lead">實力說話，成績有目共睹——這些是我對每一位客戶專業承諾的證明。</p>
            <div className="landing-card-grid">
              {ACHIEVEMENTS.map((item) => (
                <article className="achieve-card" key={item.title}>
                  <div className="landing-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4. 服務項目 */}
        <section className="landing-section service-section" id="services">
          <div className="landing-section-inner">
            <p className="section-eyebrow">SERVICES</p>
            <h2>我提供的服務項目</h2>
            <p className="section-lead">不只是買賣房子，而是陪您規劃完整的不動產人生。</p>
            <div className="landing-card-grid">
              {SERVICES.map((item) => (
                <article className="service-card" key={item.title}>
                  <div className="landing-icon service-icon">{item.icon}</div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 5. 預約 */}
        <section className="landing-section booking-section" id="booking">
          <div className="landing-section-inner booking-inner">
            <p className="section-eyebrow">CONTACT</p>
            <h2>預約諮詢</h2>
            <p className="section-lead">
              留下聯絡方式與您想處理的問題，我會依需求先做準備，24 小時內回覆，免費諮詢。
            </p>

            <ContactForm />

            {BOOKING_ENABLED && (
              <div className="booking-actions">
                <Link className="cta cta-outline" href="/card/booking">或選時段線上預約</Link>
              </div>
            )}

            <ul className="booking-facts">
              <li>
                <span aria-hidden="true">📞</span>
                <a href={`tel:${PROFILE.phoneRaw}`}>{PROFILE.phone}</a>
              </li>
              <li>
                <span aria-hidden="true">💬</span>LINE ID：kk00160
              </li>
              <li>
                <span aria-hidden="true">📍</span>
                {PROFILE.address}
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-section-inner">
          <p>
            {PROFILE.name} 台南房仲顧問 ｜ 服務區域：台南市各區，專營東橋重劃區
          </p>
          <p>
            電話：{PROFILE.phone} ｜ LINE：kk00160
          </p>
        </div>
      </footer>

      <a className="line-float" href={PROFILE.social.line} target="_blank" rel="noreferrer" aria-label="加 LINE 諮詢">
        <span>LINE 諮詢</span>
      </a>
    </div>
  );
}
