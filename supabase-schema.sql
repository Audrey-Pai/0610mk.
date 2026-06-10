-- ============================================================
-- EDT 戰情室 · Supabase Schema
-- 在 Supabase → SQL Editor 貼上整段執行一次即可
-- ============================================================

-- 來源清單（之後要新增競業 / 市場關鍵字，直接在這張表加一列即可，免重新部署）
create table if not exists feeds (
  id         bigint generated always as identity primary key,
  domain     text not null check (domain in ('market','competitor')),
  label      text not null,         -- 顯示名稱 / 競業名
  query      text not null,         -- Google News 搜尋關鍵字
  active     boolean default true,
  created_at timestamptz default now()
);

-- 抓回來的文章（點開要有內容 → 存 summary 摘要 + 來源 + 連結）
create table if not exists articles (
  id           bigint generated always as identity primary key,
  feed_id      bigint references feeds(id),
  domain       text,
  entity       text,                -- 競業名 / 市場主題
  title        text,
  url          text unique,         -- 去重靠網址
  source       text,
  published_at timestamptz,
  summary      text,                -- RSS 摘要（非全文，尊重著作權，全文走連結）
  fetched_at   timestamptz default now()
);
create index if not exists idx_articles_domain on articles(domain, published_at desc);

-- 官網能見度快照（每次爬取記一筆）
create table if not exists visibility (
  id               bigint generated always as identity primary key,
  checked_at       timestamptz default now(),
  crawlable        boolean,         -- 首頁本體爬蟲讀得到嗎
  keywords_found   text[],          -- 核心差異化字：有出現的
  keywords_missing text[],          -- 核心差異化字：缺漏的
  note             text
);

-- 種子來源：3 個市場主題 + 3 個競業（可自行增刪）
insert into feeds (domain, label, query) values
  ('market','越南設廠','越南 設廠 台商'),
  ('market','印尼投資','印尼 投資 設廠 台商'),
  ('market','東南亞建廠','東南亞 建廠 製造'),
  ('competitor','是方電訊','是方電訊'),
  ('competitor','第一線','第一線 數據通信'),
  ('competitor','中華電信企業','中華電信 企業 專線 MPLS')
on conflict do nothing;
