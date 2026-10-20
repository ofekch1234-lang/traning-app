// NextRep — transactional emails via Resend (trial ending soon). Called by SQL cron (x-cron-key).
// Needs the RESEND_API_KEY secret (Supabase → Edge Functions → Secrets). Sender: app_config 'mail_from'.
import { createClient } from "npm:@supabase/supabase-js@2";

const APP = "https://www.nextrep.co.il";
const LOGO = "https://traning-app-silk.vercel.app/icon-192.png";
type Item = { uid: string; lang?: string; w?: number; m?: number; g?: string };
// feminine overrides (Hebrew / Arabic address the reader by gender)
const F: Record<string, { none?: string; body?: string }> = {
  he: { none: "עוד יש זמן לנסות: אימון אחד וצילום ארוחה אחת, ותראי מה NextRep יודעת לעשות." },
  ar: { none: "ما زال هناك وقت للتجربة: تمرين واحد وتصوير وجبة واحدة، وسترين ما يمكن لـ NextRep فعله.", body: "لتواصلي مع خطتك وكوبي البوت ومتابعة التغذية دون توقف، اختاري باقة في التطبيق. دفعة واحدة، بلا تجديد تلقائي." },
};

const T: Record<string, { dir: string; subj: string; title: string; did: (w: number, m: number) => string; none: string; body: string; cta: string; foot: string }> = {
  he: { dir: "rtl", subj: "נשארו לך יומיים בניסיון ב-NextRep ⏳", title: "נשארו לך יומיים בניסיון", did: (w, m) => `עד עכשיו: ${w} אימונים ו-${m} ארוחות. יפה מאוד 💪`, none: "עוד יש זמן לנסות: אימון אחד וצילום ארוחה אחת, ותראה מה NextRep יודעת לעשות.", body: "כדי להמשיך עם התוכנית, קובי הבוט ומעקב התזונה בלי הפסקה, בוחרים מסלול באפליקציה. תשלום אחד, בלי חידוש אוטומטי.", cta: "לבחירת מסלול", foot: "קיבלת את המייל כי נרשמת ל-NextRep." },
  ar: { dir: "rtl", subj: "بقي يومان على فترتك التجريبية في NextRep ⏳", title: "بقي يومان على فترتك التجريبية", did: (w, m) => `حتى الآن: ${w} تمارين و${m} وجبات. أحسنت 💪`, none: "ما زال هناك وقت للتجربة: تمرين واحد وتصوير وجبة واحدة، وسترى ما يمكن لـ NextRep فعله.", body: "لتواصل مع خطتك وكوبي البوت ومتابعة التغذية دون توقف، اختر باقة في التطبيق. دفعة واحدة، بلا تجديد تلقائي.", cta: "اختيار باقة", foot: "وصلتك هذه الرسالة لأنك سجّلت في NextRep." },
  en: { dir: "ltr", subj: "2 days left in your NextRep trial ⏳", title: "2 days left in your trial", did: (w, m) => `So far: ${w} workouts and ${m} meals. Nice work 💪`, none: "Still time to try it: one workout and one meal photo, and see what NextRep can do.", body: "To keep your plan, Kobi the bot and nutrition tracking without a break, pick a plan in the app. One payment, no auto-renewal.", cta: "Choose a plan", foot: "You're receiving this because you signed up for NextRep." },
};

function html(l: string, w: number, m: number, g?: string) {
  const t = { ...(T[l] || T.he), ...(g === "f" ? F[l] || {} : {}) };
  return `<div dir="${t.dir}" style="background:#f3f5f3;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#141a16">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e3e8e4">
    <div style="background:#141a16;padding:22px;text-align:center"><img src="${LOGO}" width="56" height="56" alt="NextRep" style="border-radius:14px">
      <div dir="ltr" style="font-size:24px;font-weight:800;color:#fff;margin-top:8px">Next<span style="color:#16a34a">Rep</span></div></div>
    <div style="padding:28px 26px;text-align:center">
      <h1 style="font-size:21px;margin:0 0 12px">${t.title}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 10px;font-weight:600">${w + m > 0 ? t.did(w, m) : t.none}</p>
      <p style="font-size:15px;line-height:1.6;color:#55605a;margin:0 0 22px">${t.body}</p>
      <a href="${APP}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:12px">${t.cta}</a>
      <p style="font-size:12px;color:#8a948d;margin:22px 0 0">${t.foot}</p>
    </div></div></div>`;
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ck } = await admin.from("app_config").select("value").eq("key", "cron_key").maybeSingle();
  if (typeof ck?.value !== "string" || req.headers.get("x-cron-key") !== ck.value) return new Response("forbidden", { status: 403 });
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) { console.log(JSON.stringify({ ev: "notify-email", err: "no RESEND_API_KEY" })); return new Response(JSON.stringify({ ok: false, error: "no_key" }), { status: 200 }); }
  const { data: fromRow } = await admin.from("app_config").select("value").eq("key", "mail_from").maybeSingle();
  const from = typeof fromRow?.value === "string" ? fromRow.value : "NextRep <office@nextrep.co.il>";
  const body = await req.json().catch(() => ({}));
  const items: Item[] = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  let sent = 0; const errs: string[] = [];
  for (const it of items) {
    try {
      const { data: u } = await admin.auth.admin.getUserById(it.uid);
      const to = u?.user?.email; if (!to) continue;
      const l = ["he", "ar", "en"].includes(String(it.lang)) ? String(it.lang) : "he";
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject: (T[l] || T.he).subj, html: html(l, +it.w! || 0, +it.m! || 0, it.g) }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) sent++; else errs.push(String(r.status) + " " + (await r.text()).slice(0, 120));
    } catch (e) { errs.push(String(e).slice(0, 120)); }
  }
  console.log(JSON.stringify({ ev: "notify-email", kind: body.kind, n: items.length, sent, errs }));
  return new Response(JSON.stringify({ ok: true, sent, errs }), { headers: { "Content-Type": "application/json" } });
});
