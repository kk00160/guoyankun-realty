/**
 * 資料表型別，對應 supabase/schema.sql。
 *
 * 手寫而不是用 Supabase CLI 產生，理由：
 * 產生的檔案要裝 CLI、要登入、要記得重跑，而這裡只有四張表、欄位也不會天天變。
 * 手寫的版本改 schema.sql 時順手改這裡就好，而且看得懂。
 *
 * ⚠️ 改 supabase/schema.sql 的欄位時，這支檔案要一起改，否則型別會跟資料庫對不上。
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type ListingRow = {
  id: string;
  source: string;
  source_id: string | null;
  source_url: string | null;
  title: string;
  district: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  total_price: number | null;
  ping: number | null;
  unit_price: number | null;
  layout: string | null;
  age: number | null;
  house_type: string | null;
  floor_info: string | null;
  parking: string | null;
  images: string[];
  status: string;
  review_reasons: string[];
  first_seen_at: string;
  last_seen_at: string;
  raw: Json | null;
  created_at: string;
  updated_at: string;
};

type TourRow = {
  id: string;
  title: string;
  buyer_name: string | null;
  token: string;
  expires_at: string;
  status: string;
  origin_label: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  note: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type TourItemRow = {
  id: string;
  tour_id: string;
  listing_id: string;
  buyer_choice: string;
  buyer_note: string | null;
  decided_at: string | null;
  visit_order: number | null;
  agent_note: string | null;
  created_at: string;
  updated_at: string;
};

type CrawlRunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  districts: string[];
  found: number;
  inserted: number;
  updated: number;
  flagged: number;
  ok: boolean;
  error: string | null;
};

/** 有預設值的欄位在 insert 時可以省略，所以 Insert 一律用 Partial 再補上必填欄位。 */
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

/** update() 的參數型別。用這個而不是 Record<string, unknown>，寫錯欄位名會在 build 時被抓出來。 */
export type ListingUpdate = Partial<ListingRow>;
export type TourUpdate = Partial<TourRow>;

export type Database = {
  public: {
    Tables: {
      listings: Table<ListingRow, "title">;
      tours: Table<TourRow, "title" | "token" | "expires_at">;
      tour_items: Table<TourItemRow, "tour_id" | "listing_id">;
      crawl_runs: Table<CrawlRunRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
