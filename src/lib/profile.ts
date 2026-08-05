export const PROFILE = {
  name: "郭彥坤",
  alias: "阿坤",
  brand: "台南房仲 · 郭彥坤",
  brandMark: "坤",
  title: "台南房仲顧問 · 專營東橋重劃區",
  slogan: "9 年房仲實戰 · 全國金仲獎 · 專營東橋重劃區。",
  phone: "0921-020-851",
  phoneRaw: "0921020851",
  email: "kk00160117@gmail.com",
  address: "台南市各區 · 專營東橋重劃區",
  photoUrl: "/card/guo-yankun.jpg",
  social: {
    // 用 LINE ID 加好友必須在 ID 前加波浪號，少了會出現「無法加入好友」。
    line: "https://line.me/ti/p/~kk00160",
    // 之後有經營再填網址；留空白就不會顯示在名片上。
    facebook: "",
    instagram: "",
    youtube: ""
  }
} as const;

// 只顯示有填網址的社群連結，避免名片出現點了沒反應的死連結。
export const SOCIAL_LINKS = [
  { label: "Facebook", url: PROFILE.social.facebook as string },
  { label: "Instagram", url: PROFILE.social.instagram as string },
  { label: "YouTube", url: PROFILE.social.youtube as string }
].filter((item) => item.url.length > 0);
