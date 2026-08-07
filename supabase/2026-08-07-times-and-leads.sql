-- ---------------------------------------------------------------
-- 2026-08-07　兩件事：預約帶看時間、首頁來客名單
--
-- 到 Supabase → SQL Editor 貼上整段執行一次即可。
-- 全部都是 if not exists，重複跑不會壞。
-- ---------------------------------------------------------------

-- 1) 預約帶看時間
--
-- 房仲開幾個候選時段，買方在自己的連結上勾想要的那幾個。
-- 存成 jsonb 陣列而不是另開一張表：資料很小、永遠跟著帶看紀錄一起讀，
-- 開一張表只會多一次 join，換不到任何好處。
--
-- 每一筆長這樣：
--   { "id": "a1b2c3", "startsAt": "2026-08-10T06:00:00.000Z", "picked": false }
--   id     短亂數，買方勾選時用它對回來（不要用陣列索引，刪掉一個就全錯位）
--   picked 買方勾了沒
alter table public.tours
  add column if not exists time_slots jsonb not null default '[]'::jsonb;

-- 2) 首頁來客名單
--
-- 為什麼需要這張表：首頁的表單原本只把內容複製到剪貼簿、開啟 LINE 加好友頁，
-- 客戶如果沒去加好友貼上，那筆資料就永遠消失，後台完全不知道有人來過。
-- 現在表單會照樣複製、照樣開 LINE（那個流程是對的，不要動），
-- 但同時送一份到這裡，讓「來過但沒加好友」的客戶不再漏掉。
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),

  name       text not null,
  phone      text not null,
  service    text,                       -- 想諮詢的服務
  time_slot  text,                       -- 方便聯絡時段
  message    text,                       -- 想說的話

  -- 從哪裡來的。目前只有 home（首頁表單），之後可能有別的來源。
  source     text not null default 'home',

  -- new：還沒聯絡　contacted：聯絡過了　done：結案　spam：垃圾
  status     text not null default 'new',

  agent_note text,                       -- 你自己的備註

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_status_idx  on public.leads (status);

drop trigger if exists leads_touch on public.leads;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

-- RLS 開著且不建任何 policy —— 跟其他表一致，
-- 效果是只有 service_role key 進得來，anon key 一列都拿不到。
-- 首頁表單是透過我們自己的伺服器端 API 寫入的，不是瀏覽器直接寫資料庫。
alter table public.leads enable row level security;
