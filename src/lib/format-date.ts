/**
 * 日期時間一律走這裡，不要各自呼叫 Intl.DateTimeFormat。
 *
 * 為什麼要多這一層：
 *
 * Node 的 ICU 在日期與時間之間放的是 U+2009 細空格，Chrome 放的是一般空格。
 * 兩邊印出來的字肉眼一模一樣（「2026/09/07 01:02」），位元組卻不同，
 * 於是每一個印出日期時間的頁面都會 hydration 失敗 ——
 * React 把伺服器給的 HTML 整棵丟掉、在瀏覽器重畫一次。
 *
 * 這種錯最麻煩的地方是它「看起來完全正常」：畫面沒異狀、功能也還會動，
 * 只是慢了一拍，而且 dev 的錯誤面板從此常駐一顆紅點，
 * 真正該看的 hydration 問題就淹在裡面了。實測抓到（2026-08-09，帶看日記那一頁）。
 *
 * 所以格式化完統一把各種不可見空白換成一般空格。
 */

/**
 * 細空格（U+2009）、窄不斷行空格（U+202F）、不斷行空格（U+00A0）全部換成一般空格。
 * 一律寫成跳脫碼 —— 直接把字元貼進來的話，下一個看這段的人只會看到三個
 * 長得一模一樣的空白，完全不知道自己在改什麼。
 */
function normalizeSpaces(text: string) {
  return text.replace(/[\u2009\u202f\u00a0]/g, " ");
}

/** 台北時區格式化。專案裡所有對使用者顯示的時間都用這支。 */
export function formatInTaipei(date: Date, options: Intl.DateTimeFormatOptions) {
  return normalizeSpaces(
    new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", ...options }).format(date)
  );
}
