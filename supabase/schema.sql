-- 帶看助手資料表
--
-- 用法：Supabase 主控台 → SQL Editor → 貼上整份 → Run。
-- 可以重複執行（全部都是 if not exists），改欄位不會弄丟資料。
--
-- 安全設計：四張表全部開 RLS 但「不建任何 policy」。
-- 意思是：拿 anon key 的瀏覽器一列都讀不到，只有 service_role key 能存取，
-- 而 service_role key 只出現在伺服器端（Next.js route handler、server component、本機匯入腳本）。
-- 這比「開放 anon 讀取再靠條件過濾」安全，因為漏掉一個條件不會變成全公開。

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- listings：案源資料（匯入進來的 + 你自己手動建的）
-- ---------------------------------------------------------------
create table if not exists public.listings (
  id            uuid primary key default gen_random_uuid(),

  -- 來源。'591' 是從該站匯入的，'manual' 是你自己建的（公司內部案、朋友託售）。
  source        text        not null default 'manual',
  source_id     text,                    -- 來源網站的物件編號
  source_url    text,                    -- 原始刊登網址，買方頁一定要連回去

  title         text        not null,
  district      text,                    -- 行政區，例：東區
  address       text,
  lat           double precision,        -- 排路線用，抓不到就不能進帶看紀錄
  lng           double precision,

  total_price   numeric,                 -- 總價（萬元）
  ping          numeric,                 -- 權狀坪數
  unit_price    numeric,                 -- 單價（萬元／坪）
  layout        text,                    -- 例：3房2廳2衛
  age           numeric,                 -- 屋齡（年）
  house_type    text,                    -- 別墅／透天厝／公寓／華廈／電梯大樓
  floor_info    text,                    -- 例：4F/12F
  parking       text,
  images        text[]      not null default '{}',  -- 只存原始刊登的圖片網址，不轉存檔案

  -- active     ：資料通過合理性閘門，可以放進帶看紀錄給買方看
  -- needs_review：閘門沒過，只在後台出現，永遠不會出現在買方頁
  -- archived   ：你手動封存
  -- sold       ：已成交／已下架
  status        text        not null default 'active',
  review_reasons text[]     not null default '{}',  -- 閘門沒過的原因，中文，直接顯示在後台

  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  raw           jsonb,                   -- 原始解析結果，方便日後回頭查匯入時有沒有解錯

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 同一個來源的同一個物件只留一筆，匯入時靠這個做 upsert。
--
-- ⚠️ 不要加 `where source_id is not null` 改成部分索引。
--    看起來更精準，但 Postgres 的 ON CONFLICT 用不了部分索引，
--    匯入會噴 "no unique or exclusion constraint matching the ON CONFLICT specification"。
--    不加 where 也不會有問題：Postgres 預設 NULL 彼此相異，
--    手動建立的多筆 source_id = null 的案源不會互相衝突。
create unique index if not exists listings_source_key
  on public.listings (source, source_id);

create index if not exists listings_status_idx   on public.listings (status);
create index if not exists listings_district_idx on public.listings (district);
create index if not exists listings_price_idx    on public.listings (total_price);

-- 疑似重複刊登（同區 + 同總價 + 同坪數）靠這個索引排在一起，讓你一眼看到後手動合併。
create index if not exists listings_dedupe_idx
  on public.listings (district, total_price, ping);

-- ---------------------------------------------------------------
-- tours：一筆帶看紀錄 = 一個買方 + 一批物件 + 一個公開連結
-- ---------------------------------------------------------------
create table if not exists public.tours (
  id            uuid primary key default gen_random_uuid(),
  title         text        not null,
  buyer_name    text,                    -- 買方稱呼，買方自己填或你先填

  -- 買方連結的鑰匙。32 字元隨機，猜不到；可撤銷、有到期日。
  token         text        not null unique,
  expires_at    timestamptz not null,

  -- active：買方可看　revoked：你手動撤銷　done：帶看結束
  status        text        not null default 'active',

  -- 出發點，排路線用。空的就用第一間房子當起點。
  origin_label  text,
  origin_lat    double precision,
  origin_lng    double precision,

  note          text,

  -- 買方按下「送出」的時間。null = 還在看。
  -- 勾選本身是即時存的（關掉分頁也不會丟），這個欄位只用來區分
  -- 「還在挑」跟「挑完了，可以安排帶看」。
  submitted_at  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 舊資料庫補欄位用。整份 schema.sql 可以重複執行。
alter table public.tours add column if not exists submitted_at timestamptz;

create index if not exists tours_status_idx on public.tours (status);

-- ---------------------------------------------------------------
-- tour_items：帶看紀錄裡的每一間房，以及買方對它的選擇
-- ---------------------------------------------------------------
create table if not exists public.tour_items (
  id           uuid primary key default gen_random_uuid(),
  tour_id      uuid        not null references public.tours(id)    on delete cascade,
  listing_id   uuid        not null references public.listings(id) on delete cascade,

  -- pending：買方還沒表態　interested：想看　rejected：略過
  buyer_choice text        not null default 'pending',
  buyer_note   text,
  decided_at   timestamptz,

  visit_order  int,                      -- 排完路線後的看房順序，1 開始
  agent_note   text,                     -- 你自己的備註，不會給買方看到

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (tour_id, listing_id)
);

create index if not exists tour_items_tour_idx on public.tour_items (tour_id);

-- ---------------------------------------------------------------
-- crawl_runs：每次匯入的紀錄。
-- 用途不是留資料，是讓「匯入已經壞掉但你不知道」這件事浮出來。
-- ---------------------------------------------------------------
create table if not exists public.crawl_runs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  districts    text[]      not null default '{}',
  found        int         not null default 0,   -- 列表頁看到幾筆
  inserted     int         not null default 0,   -- 新增幾筆
  updated      int         not null default 0,   -- 更新幾筆
  flagged      int         not null default 0,   -- 被合理性閘門擋下幾筆
  ok           boolean     not null default false,
  error        text
);

create index if not exists crawl_runs_started_idx on public.crawl_runs (started_at desc);

-- ---------------------------------------------------------------
-- updated_at 自動更新
-- ---------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_touch   on public.listings;
drop trigger if exists tours_touch      on public.tours;
drop trigger if exists tour_items_touch on public.tour_items;

create trigger listings_touch   before update on public.listings   for each row execute function public.touch_updated_at();
create trigger tours_touch      before update on public.tours      for each row execute function public.touch_updated_at();
create trigger tour_items_touch before update on public.tour_items for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------
-- RLS：全部開啟，且刻意不建立任何 policy。
-- 效果 = 只有 service_role key 能存取，anon key 一列都拿不到。
-- ---------------------------------------------------------------
alter table public.listings   enable row level security;
alter table public.tours      enable row level security;
alter table public.tour_items enable row level security;
alter table public.crawl_runs enable row level security;
