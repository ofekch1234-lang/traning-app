// NextRep — transactional emails via Resend (gift Premium ending soon). Called by SQL cron (x-cron-key).
// Needs the RESEND_API_KEY secret (Supabase → Edge Functions → Secrets). Sender: app_config 'mail_from'.
import { createClient } from "npm:@supabase/supabase-js@2";

const APP = "https://www.nextrep.co.il";
const LOGO = "https://www.nextrep.co.il/icon-192.png";
type Item = { uid: string; lang?: string; w?: number; m?: number; g?: string; until?: string; t?: string; b?: string };
const CTA: Record<string, string> = { he: "לפתיחת האפליקציה", ar: "فتح التطبيق", en: "Open the app" };
const CTA_SU: Record<string, string> = { he: "לסיום ההרשמה", ar: "إكمال التسجيل", en: "Finish signing up" };
const FOOT_SU: Record<string, string> = { he: "קיבלת את המייל כי התחלת להירשם ל-NextRep.", ar: "وصلتك هذه الرسالة لأنك بدأت التسجيل في NextRep.", en: "You're receiving this because you started signing up for NextRep." };
const FOOT: Record<string, string> = { he: "קיבלת את המייל כי נרשמת ל-NextRep.", ar: "وصلتك هذه الرسالة لأنك سجّلت في NextRep.", en: "You're receiving this because you signed up for NextRep." };
// feminine overrides (Hebrew / Arabic address the reader by gender)
const F: Record<string, { none?: string; body?: string }> = {
  he: { none: "עוד יש זמן לנצל את הפרימיום: צלמי כמה ארוחות שרוצים ושאלי את קובי כל שאלה.", body: "אחרי זה ממשיכים בחינם, וכל הנתונים נשמרים. כדי להשאיר את קובי וניתוח AI ללא הגבלה, שדרגי לפרימיום או הזמיני עוד חברה." },
  ar: { none: "ما زال هناك وقت للاستفادة من بريميوم: صوّري ما تشائين من الوجبات واسألي كوبي أي سؤال.", body: "بعدها تستمرين مجانًا وتُحفظ كل بياناتك. للإبقاء على كوبي والتحليل غير المحدود، رقّي إلى بريميوم أو ادعي صديقة أخرى." },
};

// kind "trial_end": a gift Premium week (referral) ends in 2 days
const T: Record<string, { dir: string; subj: string; title: string; did: (w: number, m: number) => string; none: string; body: string; cta: string; foot: string }> = {
  he: { dir: "rtl", subj: "שבוע הפרימיום שלך ב-NextRep נגמר בעוד יומיים ⏳", title: "שבוע הפרימיום נגמר בעוד יומיים", did: (w, m) => `עד עכשיו: ${w} אימונים ו-${m} ארוחות. יפה מאוד 💪`, none: "עוד יש זמן לנצל את הפרימיום: צלם כמה ארוחות שרוצים ושאל את קובי כל שאלה.", body: "אחרי זה ממשיכים בחינם, וכל הנתונים נשמרים. כדי להשאיר את קובי וניתוח AI ללא הגבלה, שדרג לפרימיום או הזמן עוד חבר.", cta: "לפתיחת האפליקציה", foot: "קיבלת את המייל כי נרשמת ל-NextRep." },
  ar: { dir: "rtl", subj: "أسبوع بريميوم في NextRep ينتهي بعد يومين ⏳", title: "أسبوع بريميوم ينتهي بعد يومين", did: (w, m) => `حتى الآن: ${w} تمارين و${m} وجبات. أحسنت 💪`, none: "ما زال هناك وقت للاستفادة من بريميوم: صوّر ما تشاء من الوجبات واسأل كوبي أي سؤال.", body: "بعدها تستمر مجانًا وتُحفظ كل بياناتك. للإبقاء على كوبي والتحليل غير المحدود، رقِّ إلى بريميوم أو ادعُ صديقًا آخر.", cta: "فتح التطبيق", foot: "وصلتك هذه الرسالة لأنك سجّلت في NextRep." },
  en: { dir: "ltr", subj: "Your NextRep Premium week ends in 2 days ⏳", title: "Your Premium week ends in 2 days", did: (w, m) => `So far: ${w} workouts and ${m} meals. Nice work 💪`, none: "Still time to enjoy Premium: snap as many meals as you like and ask Kobi anything.", body: "After that you continue for free and all your data is kept. To keep Kobi and unlimited AI analysis, upgrade to Premium or invite another friend.", cta: "Open the app", foot: "You're receiving this because you signed up for NextRep." },
};

// kind "gift_end": a gift Premium month (friend upgraded) ends in 3 days
const GIFT: Record<string, Record<string, { subj: string; title: string; none: string; body: string; cta: string }>> = {
  m: {
    he: { subj: "חודש הפרימיום מתנה שלך ב-NextRep נגמר בעוד 3 ימים 🎁", title: "חודש הפרימיום מתנה נגמר בעוד 3 ימים", none: "הפרימיום שלך פתוח עד {until}. אחר כך ממשיכים בחינם, וכל הנתונים נשמרים.", body: "כדי להשאיר את קובי וניתוח AI ללא הגבלה, שדרג לפרימיום. או הזמן עוד חבר: כשהוא משדרג, אתה מקבל עוד חודש מתנה.", cta: "לפתיחת האפליקציה" },
    ar: { subj: "شهر بريميوم الهدية في NextRep ينتهي بعد 3 أيام 🎁", title: "شهر بريميوم الهدية ينتهي بعد 3 أيام", none: "بريميوم الخاص بك مفتوح حتى {until}. بعدها تستمر مجانًا وتُحفظ كل بياناتك.", body: "للإبقاء على كوبي والتحليل غير المحدود رقِّ إلى بريميوم. أو ادعُ صديقًا آخر: عندما يرقّي تحصل على شهر هدية إضافي.", cta: "فتح التطبيق" },
    en: { subj: "Your NextRep gift Premium month ends in 3 days 🎁", title: "Your gift Premium month ends in 3 days", none: "Your Premium is open until {until}. After that you continue for free and all your data is kept.", body: "To keep Kobi and unlimited AI analysis, upgrade to Premium. Or invite another friend: when they upgrade, you get one more free month.", cta: "Open the app" },
  },
  f: {
    he: { subj: "חודש הפרימיום מתנה שלך ב-NextRep נגמר בעוד 3 ימים 🎁", title: "חודש הפרימיום מתנה נגמר בעוד 3 ימים", none: "הפרימיום שלך פתוח עד {until}. אחר כך ממשיכים בחינם, וכל הנתונים נשמרים.", body: "כדי להשאיר את קובי וניתוח AI ללא הגבלה, שדרגי לפרימיום. או הזמיני עוד חברה: כשהיא משדרגת, את מקבלת עוד חודש מתנה.", cta: "לפתיחת האפליקציה" },
    ar: { subj: "شهر بريميوم الهدية في NextRep ينتهي بعد 3 أيام 🎁", title: "شهر بريميوم الهدية ينتهي بعد 3 أيام", none: "بريميوم الخاص بك مفتوح حتى {until}. بعدها تستمرين مجانًا وتُحفظ كل بياناتك.", body: "للإبقاء على كوبي والتحليل غير المحدود رقّي إلى بريميوم. أو ادعي صديقة أخرى: عندما ترقّي تحصلين على شهر هدية إضافي.", cta: "فتح التطبيق" },
    en: { subj: "Your NextRep gift Premium month ends in 3 days 🎁", title: "Your gift Premium month ends in 3 days", none: "Your Premium is open until {until}. After that you continue for free and all your data is kept.", body: "To keep Kobi and unlimited AI analysis, upgrade to Premium. Or invite another friend: when they upgrade, you get one more free month.", cta: "Open the app" },
  },
};
function html(l: string, w: number, m: number, g?: string, kind?: string, until?: string, ft?: string, fb?: string) {
  const base = { ...(T[l] || T.he), ...(g === "f" ? F[l] || {} : {}) };
  // kind "first_workout": title and body come ready (localized and gendered) from first_workout_nudges()
  if (kind === "first_workout") Object.assign(base, { title: ft || "", none: fb || "", body: "", cta: CTA[l] || CTA.he, foot: FOOT[l] || FOOT.he });
  // kind "finish_signup": started signing up (email entered) but never entered the code — from finish_signup_nudges()
  if (kind === "finish_signup") Object.assign(base, { title: ft || "", none: fb || "", body: "", cta: CTA_SU[l] || CTA_SU.he, foot: FOOT_SU[l] || FOOT_SU.he });
  const gift = kind === "gift_end" ? (GIFT[g === "f" ? "f" : "m"][l] || GIFT.m.he) : null;
  const t = gift ? { ...base, title: gift.title, none: gift.none.replace("{until}", until || ""), body: gift.body, cta: gift.cta, did: () => gift.none.replace("{until}", until || "") } : base;
  return `<div dir="${t.dir}" style="background:#f3f5f3;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#141a16">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e3e8e4">
    <div style="background:#141a16;padding:22px;text-align:center"><img src="${LOGO}" width="56" height="56" alt="NextRep" style="border-radius:14px">
      <div dir="ltr" style="font-size:24px;font-weight:800;color:#fff;margin-top:8px">Next<span style="color:#16a34a">Rep</span></div></div>
    <div style="padding:28px 26px;text-align:center">
      <h1 style="font-size:21px;margin:0 0 12px">${t.title}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 10px;font-weight:600">${w + m > 0 ? t.did(w, m) : t.none}</p>
      ${t.body ? `<p style="font-size:15px;line-height:1.6;color:#55605a;margin:0 0 22px">${t.body}</p>` : `<div style="height:12px"></div>`}
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
        body: JSON.stringify({ from, to: [to], subject: (body.kind === "first_workout" || body.kind === "finish_signup") ? String(it.t || "NextRep") : body.kind === "gift_end" ? (GIFT[it.g === "f" ? "f" : "m"][l] || GIFT.m.he).subj : (T[l] || T.he).subj, html: html(l, body.kind === "first_workout" || body.kind === "finish_signup" ? 0 : +it.w! || 0, body.kind === "first_workout" || body.kind === "finish_signup" ? 0 : +it.m! || 0, it.g, body.kind, it.until, it.t, it.b) }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.ok) sent++; else errs.push(String(r.status) + " " + (await r.text()).slice(0, 120));
    } catch (e) { errs.push(String(e).slice(0, 120)); }
  }
  console.log(JSON.stringify({ ev: "notify-email", kind: body.kind, n: items.length, sent, errs }));
  return new Response(JSON.stringify({ ok: true, sent, errs }), { headers: { "Content-Type": "application/json" } });
});
