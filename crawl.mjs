// ============================================================
// crawl.mjs · 定時爬蟲（每 6 小時自動執行）
//   1) 讀 feeds 表 → 逐一抓 Google News RSS → 寫入 articles（去重）
//   2) 抓 edtns.net 首頁 → 計算官網能見度快照 → 寫入 visibility
// 手動跑第一次：Netlify → Functions → crawl → Trigger
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";

export const config = { schedule: "0 */6 * * *" }; // 每 6 小時

// 官網「應該要有」的核心差異化關鍵字（檢核首頁爬蟲讀得到哪些）
const KEYWORDS = [
  "東南亞", "越南", "印尼", "泰國", "跨境",
  "資安", "MSSP", "SOC", "台商", "在地", "單一窗口", "據點",
];

const stripHtml = (s) =>
  String(s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ").trim();

export default async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  let inserted = 0, feedsRun = 0;

  // 1) 抓各來源
  const { data: feeds, error: fErr } = await supabase
    .from("feeds").select("*").eq("active", true);
  if (fErr) console.error("讀 feeds 失敗:", fErr.message);

  for (const f of feeds ?? []) {
    try {
      const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(f.query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
      const res = await fetch(rss, { headers: { "User-Agent": "Mozilla/5.0 (EDT-WarRoom)" } });
      const xml = await res.text();
      const json = parser.parse(xml);
      let items = json?.rss?.channel?.item ?? [];
      if (!Array.isArray(items)) items = [items];
      feedsRun++;

      for (const it of items.slice(0, 20)) {
        const url = it.link;
        const title = stripHtml(it.title);
        if (!url || !title) continue;
        const src = typeof it.source === "object" ? (it.source["#text"] || it.source.url) : (it.source || f.label);
        const published = it.pubDate ? new Date(it.pubDate).toISOString() : null;
        const summary = stripHtml(it.description).slice(0, 600);

        const { error } = await supabase.from("articles").upsert(
          {
            feed_id: f.id, domain: f.domain, entity: f.label,
            title, url, source: src, published_at: published,
            summary, fetched_at: new Date().toISOString(),
          },
          { onConflict: "url" }
        );
        if (!error) inserted++;
      }
    } catch (e) {
      console.error("來源失敗:", f.label, e.message);
    }
  }

  // 2) 官網能見度快照
  try {
    const r = await fetch("https://www.edtns.net/", {
      headers: { "User-Agent": "Mozilla/5.0 (EDT-WarRoom)" },
    });
    const html = (await r.text()).toLowerCase();
    const crawlable = !/doesn't work properly without javascript|請開啟/i.test(html);
    const found = KEYWORDS.filter((k) => html.includes(k.toLowerCase()));
    const missing = KEYWORDS.filter((k) => !html.includes(k.toLowerCase()));
    await supabase.from("visibility").insert({
      crawlable, keywords_found: found, keywords_missing: missing,
      note: crawlable ? "首頁本體可爬" : "首頁為 JS 空殼，爬蟲僅讀得到 meta",
    });
  } catch (e) {
    console.error("能見度快照失敗:", e.message);
  }

  return new Response(JSON.stringify({ ok: true, feedsRun, inserted }), {
    headers: { "content-type": "application/json" },
  });
};
