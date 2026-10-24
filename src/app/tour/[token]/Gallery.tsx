"use client";

import { useRef, useState } from "react";
import { resizeImage } from "@/lib/listings";

/**
 * 一間房的照片相簿。
 *
 * 用 CSS scroll-snap 做橫向滑動，不寫任何拖曳邏輯 ——
 * 手機上原生的慣性滑動比自己寫的順，而且不會跟頁面的上下捲動打架。
 *
 * ⚠️ 但一定要有左右箭頭，不能只靠滑。
 * 實際踩過：買方在電腦上打開連結，滑鼠滾輪只會上下捲，橫向捲軸又被藏起來，
 * 結果他以為「這間只有一張照片」。手機上滑得動，所以自己測不會發現。
 *
 * 挑選頁與行程頁共用同一份 —— 買方在兩條連結上看到的照片操作方式要一樣。
 */
export default function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  if (photos.length === 0) {
    return <div className="buyer-photo buyer-photo-empty">沒有照片</div>;
  }

  /** 捲到第 n 張。用捲動而不是換 src，才不會跟 scroll-snap 打架。 */
  function goTo(next: number) {
    const track = trackRef.current;
    if (!track) return;
    const wrapped = (next + photos.length) % photos.length;
    track.scrollTo({ left: wrapped * track.clientWidth, behavior: "smooth" });
    setIndex(wrapped);
  }

  return (
    <div className="buyer-gallery">
      <div
        className="buyer-track"
        ref={trackRef}
        onScroll={(event) => {
          const el = event.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((src) => (
          // 原生 img：不把來源網站的圖片轉存到自己的網域。
          <img key={src} className="buyer-photo" src={resizeImage(src, "card")} alt={alt} loading="lazy" />
        ))}
      </div>

      {photos.length > 1 && (
        <>
          <button type="button" className="buyer-nav buyer-prev" onClick={() => goTo(index - 1)} aria-label="上一張">
            ‹
          </button>
          <button type="button" className="buyer-nav buyer-next" onClick={() => goTo(index + 1)} aria-label="下一張">
            ›
          </button>
          <div className="buyer-counter">
            {index + 1} / {photos.length}
          </div>
          <div className="buyer-dots">
            {photos.slice(0, 12).map((src, i) => (
              <span key={src} data-on={i === index} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
