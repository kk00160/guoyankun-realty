-- ---------------------------------------------------------------
-- 2026-08-09　線上預約改接 Google 日曆
--
-- 到 Supabase → SQL Editor 貼上整段執行一次即可。
-- 全部都是 if not exists，重複跑不會壞。
--
-- 為什麼需要這兩張表：
-- 預約原本存在 data/appointments.json，Vercel 的檔案系統唯讀且不持久，
-- 客戶送出的預約會直接消失。所以預約系統一直是關著的。
-- 改存這裡之後才有辦法打開。
-- ---------------------------------------------------------------

-- 讓 exclude 約束可以比對「範圍重疊」。
create extension if not exists btree_gist;

-- 1) 預約
create table if not exists public.appointments (
  id           uuid primary key default gen_random_uuid(),

  -- 人看得懂的案件編號，例：AP-260809-01
  -- 為什麼不用 uuid 對客戶講：電話裡念得出來的編號才有用。
  case_no      text not null unique,

  name         text not null,
  phone        text not null,
  email        text,
  line_id      text,

  -- office 現場面談 / phone 電話 / video 線上視訊
  meet_type    text not null default 'office',

  -- 想談什麼，可複選。例：["buy","tax"]
  intent       jsonb not null default '[]'::jsonb,

  -- asap 越快越好 / soon 這個月 / explore 先了解
  urgency      text,
  note         text,

  -- 預約的起訖時間。一律存 timestamptz，顯示時才轉台北時間。
  --
  -- 為什麼存結束時間而不是「長度幾分鐘」：
  -- 下面的重疊排除需要一個 IMMUTABLE 的運算式，而 timestamptz + interval
  -- 在 Postgres 裡是 STABLE（跟時區與日光節約有關），不能放進索引。
  -- 存兩個時間點就沒這個問題，也不會有「長度跟結束時間對不起來」的狀況。
  slot_at      timestamptz not null,
  slot_end     timestamptz not null,

  -- confirmed 已成立 / cancelled 已取消 / completed 已完成
  status       text not null default 'confirmed'
               check (status in ('confirmed', 'cancelled', 'completed')),

  -- Google 日曆上對應的事件 id。沒綁定日曆時是空的，預約照樣成立。
  google_event_id text,

  -- 從哪裡來的（card 名片頁、home 首頁…）
  source       text not null default 'card',

  agent_note   text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz,
  cancelled_at timestamptz,

  constraint appointments_slot_order check (slot_end > slot_at)
);

-- 表如果是先前版本建的，補上 slot_end。
alter table public.appointments add column if not exists slot_end timestamptz;

do $$
begin
  -- 舊資料沒有 slot_end 的話，先用「開始時間 + 30 分鐘」補起來再設成必填。
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'appointments'
      and column_name = 'slot_end' and is_nullable = 'YES'
  ) then
    update public.appointments set slot_end = slot_at + interval '30 minutes' where slot_end is null;
    alter table public.appointments alter column slot_end set not null;
  end if;
end $$;

-- ⚠️ 撞號防護的關鍵：資料庫層的重疊排除。
--
-- 為什麼一定要在資料庫做，不能在程式裡判斷：
-- 舊版用一個行程內的鎖（appointment-store.ts 的 writeQueue），
-- 那只在「同一個 Node 行程」內有效。Vercel 是無伺服器，
-- 兩個客戶同時送出很可能落在兩台不同的機器上，兩邊都查到「這個時段是空的」，
-- 然後雙雙寫入 —— 你就同時答應了兩個人。
--
-- 用 exclude 約束的話，第二筆會被資料庫直接擋下來，
-- 不管它是從哪一台機器來的。
--
-- 只約束 confirmed：已取消的預約不該繼續佔著時段。
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_no_overlap'
  ) then
    alter table public.appointments
      add constraint appointments_no_overlap
      exclude using gist (
        tstzrange(slot_at, slot_end) with &&
      ) where (status = 'confirmed');
  end if;
end $$;

create index if not exists appointments_slot_idx    on public.appointments (slot_at);
create index if not exists appointments_status_idx  on public.appointments (status, slot_at);
create index if not exists appointments_created_idx on public.appointments (created_at desc);

-- 2) 預約系統的設定（key-value）
--
-- 存 Google 的 refresh token、要寫進哪本日曆、日曆事件的標題樣板與顏色。
-- 為什麼不放環境變數：refresh token 是「你在後台按授權」當下才拿到的，
-- 不可能事先寫進 Vercel 設定；標題樣板則是你會想隨時改的東西。
create table if not exists public.appointment_config (
  k          text primary key,
  v          text,
  updated_at timestamptz not null default now()
);

-- 3) RLS：跟其他表一致，開啟但不給任何 policy。
--    anon key 讀不到任何東西，所有查詢都只能從伺服器端用 service_role 進行。
alter table public.appointments       enable row level security;
alter table public.appointment_config enable row level security;
