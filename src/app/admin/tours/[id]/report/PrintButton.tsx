"use client";

/**
 * 列印按鈕。
 *
 * 刻意不裝任何 PDF 套件：瀏覽器的「列印 → 儲存為 PDF」產出的品質已經夠好，
 * 而且中文字型不會像多數 PDF 套件那樣變成豆腐字。
 */
export default function PrintButton() {
  return (
    <button type="button" className="button" onClick={() => window.print()}>
      列印 / 存成 PDF
    </button>
  );
}
