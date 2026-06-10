// ============================================================
// data.mjs · 前端讀取 API
//   GET /.netlify/functions/data
//   回傳 { market:[], competitor:[], visibility:{}, generated_at }
// ============================================================
import { createClient } from "@supabase/supabase-js";

export default async () => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const [{ data: market }, { data: competitor }, { data: vis }] = await Promise.all([
      supabase.from("articles").select("*").eq("domain", "market")
        .order("published_at", { ascending: false }).limit(40),
      supabase.from("articles").select("*").eq("domain", "competitor")
        .order("published_at", { ascending: false }).limit(40),
      supabase.from("visibility").select("*")
        .order("checked_at", { ascending: false }).limit(1),
    ]);

    const payload = {
      market: market ?? [],
      competitor: competitor ?? [],
      visibility: (vis && vis[0]) || null,
      generated_at: new Date().toISOString(),
    };
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
};
