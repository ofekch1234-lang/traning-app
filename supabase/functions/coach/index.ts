// NextRep — AI coach (Haiku 5.5).
//  mode "summary": weekly summary (once per week per user) — Premium only (paid / gift / referral days / admin).
//  mode "chat":    Q&A with the coach — Premium only, 20 questions / 24h.
//  mode "weekly":  cron (x-cron-key) — generates this week's summary for active users and queues a push.
// The coach answers from a compact, pre-computed digest of the user's own data (computed here, not by the model).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-haiku-5-5";
const DAILY_CHAT = 20;
// the app's exercise library (Hebrew names are the keys of the demo videos)
const EX_LIB = `חזה: לחיצת חזה במוט, לחיצת חזה במשקולות, לחיצת חזה בשיפוע, לחיצה בשיפוע במוט, לחיצת חזה בשיפוע שלילי, לחיצה במכונת חזה, לחיצת חזה בסמית׳, פרפר (פק-דק), פרפר במשקולות, פרפר בשיפוע, כבלים מוצלבים, מקבילים לחזה, פולאובר במשקולת, שכיבות סמיכה, לחיצת חזה בשיפוע שלילי במשקולות, לחיצת חזה באחיזה ניטרלית, לחיצה בשיפוע באחיזה ניטרלית, לחיצת חזה בכבל, לחיצה בשיפוע בכבל, פרפר בכבל על ספסל, פרפר בכבל בשיפוע, כבלים מוצלבים מלמטה, כבל מוצלב ביד אחת, פרפר בשיפוע שלילי, לחיצת חזה במכונת מנופים, לחיצה בשיפוע במכונת מנופים, לחיצה בשיפוע בסמית׳, לחיצת חזה במוט באחיזה רחבה, שכיבות סמיכה בשיפוע, שכיבות סמיכה עם רגליים מוגבהות, שכיבות סמיכה רחבות, פולאובר במשקולת בזרועות כפופות
גב: פולי עליון, פולי צר, מתח, מתח באחיזה הפוכה, חתירה בכבל, חתירה במוט, חתירה במשקולת, חתירת T, חתירה הפוכה (משקל גוף), דדליפט, דדליפט סומו, פולאובר בכבל, פייס פול, שראגים, פשיטת גב (היפראקסטנשן), חתירה בשתי משקולות, חתירה על ספסל משופע, חתירה במוט באחיזה הפוכה, חתירה בכבל ביד אחת, פולי עליון ביד אחת, פולי עליון בידית V, פולי עליון באחיזה הפוכה, פולאובר בכבל עם חבל, חתירה גבוהה במכונה, חתירה במכונה, חתירת T בשכיבה, חתירה במוט לנדמיין, חתירה ביד אחת במוט לנדמיין, שראגים במוט, שראגים בכבל, רק פול, דדליפט מהגבהה, חתירה בסמית׳, מתח בידית V, חתירה בשני קטלבלים, חתירה מפולי עליון ביד אחת
רגליים: סקוואט, סקוואט קדמי, סקוואט גביע, סקוואט בסמית׳, האק סקוואט, לחיצת רגליים, סקוואט בולגרי, לאנג׳ים, לאנג׳ים בהליכה, עליות על ספסל, פשיטת ברכיים, כפיפת ברכיים, כפיפת ברכיים בישיבה, דדליפט רומני, היפ תראסט, גשר ישבן, מכונת מקרבים, מכונת מרחיקים, הרמות עקבים, הרמות עקבים בישיבה, סקוואט לארגז, סקוואט רחב במוט, סקוואט במשקולות, סקוואט סומו במשקולת, סקוואט משקל גוף, סקוואט קדמי בשני קטלבלים, לאנג׳ים במוט, לאנג׳ים בהליכה במוט, לאנג׳ים לאחור במשקולות, לאנג׳ אחורי מהגבהה, לאנג׳ צידי במוט, עליות על ספסל במשקולות, עליות על ספסל במוט, סקוואט בולגרי בסמית׳, האק סקוואט במוט, לחיצת רגליים בעמידה צרה, פשיטת ברכיים ברגל אחת, כפיפת ברכיים בעמידה, גלוט האם רייז, כפיפת ברכיים נורדית, דדליפט ברגליים ישרות, דדליפט רומני במשקולות, דדליפט ברגל אחת בקטלבל, גוד מורנינג, פול-ת׳רו בכבל, גשר ישבן ברגל אחת, גשר ישבן משקל גוף, קיקבק ישבן על הברכיים, קיקבק ישבן בכבל, היפראקסטנשן הפוך, הליכת מפלצת עם גומייה, קירוב ירך בכבל, הרמות עקבים במכונת רגליים, הרמות עקבים במשקולות, הרמות עקבים בסמית׳, קפיצות סקוואט, לאנג׳ים בקפיצה
כתפיים: לחיצת כתפיים במשקולות, לחיצת כתפיים במוט, לחיצת כתפיים במכונה, לחיצת ארנולד, פוש פרס, הרחקות צד, הרחקות צד בכבל, הרמות קדמיות, הרחקות אחוריות, חתירה אנכית, לחיצת כתפיים בעמידה במשקולות, לחיצת כתפיים בישיבה במוט, לחיצת כתפיים בסמית׳, לחיצת כתפיים בכבל, לחיצת כתפיים ביד אחת, לחיצת כתפיים במכונת מנופים, הרחקות צד ביד אחת, הרחקות צד בישיבה, הרחקות צד בגומייה, הרמות קדמיות בכבל, הרחקות אחוריות בכבל, פרפר הפוך במכונה, הרחקות אחוריות בישיבה, משיכת גומייה לצדדים, הרמות Y במשקולות, חתירה אנכית ביד אחת, חתירה אנכית במשקולות, חתירה אנכית בכבל, סיבוב חיצוני בכבל, סיבוב חיצוני בגומייה, הילה בקטלבל, הנפה ולחיצה
יד קדמית: כפיפת מרפקים במוט, כפיפת מרפקים במשקולות, פטישים, פטישים בכבל (חבל), כפיפה בספסל כומר, כפיפה בשיפוע, כפיפה בריכוז, כפיפת מרפקים בכבל, כפיפה הפוכה במוט, כפיפת מרפקים במוט EZ, כפיפה במוט באחיזה רחבה, כפיפה לסירוגין במשקולות, כפיפת מרפקים בישיבה, פטישים לסירוגין, פטישים לרוחב הגוף, פטישים בשיפוע, כפיפת עכביש, כפיפת גרירה, כפיפת זוטמן, כפיפת מרפקים במכונה, ספסל כומר במכונה, ספסל כומר בכבל, ספסל כומר ביד אחת, כפיפה בכבל מעל הראש, כפיפה בכבל גבוה, כפיפה הפוכה בכבל, כפיפה הפוכה במשקולות, כפיפת שורש כף יד במוט, פשיטת שורש כף יד במוט
יד אחורית: פשיטת מרפקים בכבל, פשיטה בחבל בכבל, לחיצה צרפתית, פשיטה מעל הראש בכבל, לחיצת חזה צרה, מקבילים, מקבילים על ספסל, קיקבק במשקולת, פשיטה מעל הראש במשקולת, לחיצה צרפתית במשקולות, לחיצה צרפתית במוט ישר, פשיטה מעל הראש במוט, פשיטה בכבל באחיזה הפוכה, פשיטה בכבל בידית V, פשיטה בכבל ביד אחת, פשיטת מרפקים במכונה, מכונת מקבילים, שכיבות סמיכה צרות, לחיצה צרה במשקולות, לחיצה צרה בסמית׳, לחיצת רצפה במשקולות, לחיצת רצפה במוט, לחיצת JM, לחיצת טייט
בטן וליבה: כפיפות בטן, כפיפות בטן בכבל, הרמות רגליים בתלייה, הרמות רגליים בשכיבה, פלאנק, גלגל בטן, רוסיאן טוויסט, אופניים (בטן), מטפס הרים, דד באג, פאלוף פרס, סופרמן, מכונת כפיפות בטן, כפיפות בטן בשיפוע שלילי, כפיפות בטן הפוכות, סיט-אפ, סכין מתקפלת, כפיפות בטן אלכסוניות, כפיפות בטן לרוחב, פלאנק צידי, כפיפות צד במשקולת, חוטב עצים בכבל, הרמה אלכסונית בכבל, גלגול בטן במוט, משיכת ברכיים לחזה, משיכת ברכיים על ספסל, סיבובי לנדמיין, נגיעות בעקבים, מרפק לברך, כפיפות בטן הפוכות בכבל, זחילת עכביש
פונקציונלי: סווינג קטלבל, הליכת חקלאי, קפיצה לארגז, טורקיש גט-אפ, ת׳ראסטר בקטלבל, פאוור קלין, קלין במשקולות, ניתורים צידיים, קפיצות כוכב, קפיצות מעל ספסל
אירובי: הליכון, ריצה בהליכון, אופניים, אליפטיקל, מדרגות, חתירה (ארגומטר), קפיצה בחבל, אופני שכיבה`;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const LANG_NAME: Record<string, string> = { he: "Hebrew", ar: "Arabic (simple Modern Standard Arabic)", en: "English" };

// ---------- dates (Asia/Jerusalem) ----------
function ilYmd(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return p; // YYYY-MM-DD
}
function weekKey(d = new Date()) { // Sunday that starts the current week (IL)
  const ymd = ilYmd(d); const t = new Date(ymd + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() - t.getUTCDay()); return t.toISOString().slice(0, 10);
}
const e1rm = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));

// ---------- data digest ----------
async function digest(sb: SupabaseClient, uid: string) {
  const since = Date.now() - 56 * 864e5;
  const [w, m, bw, st, u] = await Promise.all([
    sb.from("workouts").select("name,start_ts,end_ts,ex").eq("user_id", uid).gte("start_ts", since).order("start_ts"),
    sb.from("meals").select("d,kcal,protein").eq("user_id", uid).gte("d", ilYmd(new Date(Date.now() - 14 * 864e5))),
    sb.from("bodyweight").select("d,kg").eq("user_id", uid).gte("d", ilYmd(new Date(Date.now() - 60 * 864e5))).order("d"),
    sb.from("settings").select("prefs").eq("user_id", uid).maybeSingle(),
    sb.auth.admin.getUserById(uid),
  ]);
  const prefs = (st.data as any)?.prefs || {};
  const name = String(u.data?.user?.user_metadata?.full_name || "").trim().split(/\s+/)[0] || "";
  const W = (w.data || []) as any[];
  const now = Date.now(), wk = (ts: number) => Math.floor((now - ts) / (7 * 864e5)); // 0 = last 7 days
  const lines: string[] = [];
  const g = prefs.g === "f" ? "female" : prefs.g === "m" ? "male" : (prefs.body?.sex === "f" ? "female" : prefs.body?.sex === "m" ? "male" : "");
  lines.push(`Today (Israel): ${ilYmd(new Date())}. User first name: ${name || "unknown"}.` + (g ? ` The user is ${g}: in Hebrew and Arabic always address them with ${g} grammatical forms (verbs, adjectives, pronouns).` : ""));
  // workouts per week
  const per = [0, 0, 0, 0], sets = [0, 0, 0, 0], vol = [0, 0, 0, 0];
  const exMap = new Map<string, { n: number; byWeek: number[]; last: string }>();
  let cardioMin = 0;
  for (const x of W) {
    const k = wk(x.start_ts); if (k > 7) continue;
    if (k < 4) per[k]++;
    for (const e of x.ex || []) {
      if (e.t === "c") { if (k === 0) cardioMin += +e.c?.min || 0; continue; }
      const done = (e.sets || []).filter((s: any) => +s.r > 0);
      if (!done.length) continue;
      if (k < 4) { sets[k] += done.length; vol[k] += done.reduce((a: number, s: any) => a + (+s.w || 0) * (+s.r || 0), 0); }
      const best = Math.max(...done.map((s: any) => e1rm(+s.w || 0, +s.r || 0)));
      const top = done.reduce((a: any, s: any) => (+s.w || 0) > (+a.w || 0) ? s : a, done[0]);
      const r = exMap.get(e.n) || { n: 0, byWeek: Array(8).fill(0), last: "" };
      r.n++; r.byWeek[k] = Math.max(r.byWeek[k], best); r.last = `${+top.w || 0}kg×${+top.r || 0}`;
      exMap.set(e.n, r);
    }
  }
  const planned = Object.values(prefs.schedule || {}).filter(Boolean).length;
  lines.push(`Workouts per week (this week → 3 weeks ago): ${per.join(", ")}${planned ? `; planned per week: ${planned}` : ""}.`);
  lines.push(`Working sets per week: ${sets.join(", ")}. Volume kg per week: ${vol.map(Math.round).join(", ")}.`);
  if (cardioMin) lines.push(`Cardio this week: ${cardioMin} min.`);
  const lastW = W[W.length - 1];
  lines.push(lastW ? `Last workout: "${lastW.name}" ${Math.floor((now - lastW.start_ts) / 864e5)} days ago.` : "No workouts logged in the last 8 weeks.");
  // exercise trends
  const ex = [...exMap.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8);
  if (ex.length) {
    lines.push("Main exercises (estimated 1RM by week, newest first, 0 = not done) and last top set:");
    for (const [n, r] of ex) {
      const recent = Math.max(r.byWeek[0], r.byWeek[1]), older = Math.max(...r.byWeek.slice(2, 6));
      const trend = !older || !recent ? "n/a" : recent > older * 1.02 ? "improving" : recent < older * 0.97 ? "dropping" : "stalled";
      lines.push(`- ${n}: ${r.byWeek.slice(0, 6).map((v) => Math.round(v)).join("/")} · last ${r.last} · trend ${trend}`);
    }
  }
  // nutrition
  const M = (m.data || []) as any[];
  const days = new Map<string, { k: number; p: number }>();
  const from7 = ilYmd(new Date(Date.now() - 6 * 864e5));
  for (const x of M) { if (x.d < from7) continue; const d = days.get(x.d) || { k: 0, p: 0 }; d.k += +x.kcal || 0; d.p += +x.protein || 0; days.set(x.d, d); }
  if (days.size) {
    const arr = [...days.values()];
    const ak = Math.round(arr.reduce((a, b) => a + b.k, 0) / arr.length), ap = Math.round(arr.reduce((a, b) => a + b.p, 0) / arr.length);
    const lowP = prefs.protT ? arr.filter((d) => d.p < prefs.protT * 0.9).length : 0;
    lines.push(`Nutrition last 7 days: logged ${days.size}/7 days, avg ${ak} kcal and ${ap} g protein per logged day${prefs.kcalT ? `; kcal target ${prefs.kcalT}` : ""}${prefs.protT ? `; protein target ${prefs.protT} g (below target on ${lowP} days)` : ""}.`);
  } else lines.push(`Nutrition: no meals logged in the last 7 days${prefs.kcalT ? ` (kcal target ${prefs.kcalT}, protein target ${prefs.protT || "?"} g)` : ""}.`);
  // body weight
  const B = (bw.data || []) as any[];
  if (B.length) {
    const first = B[0], last = B[B.length - 1];
    const wkAgo = [...B].reverse().find((x) => x.d <= ilYmd(new Date(Date.now() - 6 * 864e5)));
    lines.push(`Body weight: ${last.kg} kg on ${last.d}${wkAgo ? `; ${wkAgo.kg} kg a week before` : ""}; ${first.kg} kg on ${first.d}${prefs.goalKg ? `; goal ${prefs.goalKg} kg` : ""}.`);
  } else lines.push(`Body weight: not logged recently${prefs.goalKg ? ` (goal ${prefs.goalKg} kg)` : ""}.`);
  return { text: lines.join("\n"), name, hasData: W.length > 0 || M.length > 0 || B.length > 0 };
}

function system(lang: string, kind: "chat" | "summary") {
  return `Your name is Repi ("ראפי" in Hebrew, "ريبي" in Arabic, "Repi" in English), a friendly robot personal coach inside NextRep, a gym workout + nutrition tracking app. If you introduce yourself or sign off, use that name. You coach strength training, hypertrophy, conditioning, nutrition for training, recovery and consistency.
Write ONLY in ${LANG_NAME[lang] || "Hebrew"}. Exercise names in the data are Hebrew: translate them naturally into the reply language (in Hebrew keep them as is).
Base everything on the user's data digest below — cite concrete numbers. Never invent data that is not in the digest; if something is missing, say so briefly and suggest logging it.
Tone: warm, direct, motivating, like a good personal trainer texting. Address the user in the second person singular (in Hebrew and Arabic: singular in the user's gender from the digest — male "שב", "משוך"; female "שבי", "משכי"; masculine if unknown — never plural forms like "שבו", "משכו"). Plain text only: no markdown, no ** or #. Short lines; you may use a few emoji bullets.
Safety: you are not a doctor. For pain, injury, illness or medication questions give only general safety advice and recommend a physician or physiotherapist. Never recommend extreme diets (below ~1200 kcal/day for women or ~1500 for men), dehydration, or performance-enhancing drugs.
Exercises: prefer exercises from the app's EXERCISE LIBRARY below. When asked how to perform an exercise, give 3–4 short technique cues and one common mistake to avoid.
Demo videos: the app shows a demo video card for every library exercise you put in a final tag line. Whenever your reply recommends, lists or explains specific exercises, end the reply with ONE extra line in exactly this format: [[demo: name | name | name]] — up to 3 names copied EXACTLY (in Hebrew, character for character) from the library, in the order you mentioned them. Never say you cannot show demos, examples or videos; say the demos are right below. Omit the tag line only when no exercise is discussed.

EXERCISE LIBRARY (group: names):
${EX_LIB}
Scope: only training, nutrition, recovery, body composition, motivation and how to use NextRep. If asked about anything else, decline in one sentence and steer back to training.
${kind === "summary"
    ? "Task: write this week's coaching summary. Structure: one short greeting line using the first name; 2–4 short lines of observations (wins first, then gaps) with numbers; then 1–2 concrete focus points for the coming week (e.g. a specific load/rep target for a stalled lift, protein, missed sessions). Max 90 words."
    : "Task: answer the user's question in max ~110 words. Be specific and practical. Do NOT end your reply with a question and do not invite further chat — finish with one clear, concrete action step (then the demo tag line, if any). Only if the question cannot be answered without a missing detail, ask for that single detail instead of answering."}`;
}

async function claude(sys: string, messages: unknown[], maxTokens: number) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    // Haiku 5.5: adaptive thinking is on by default and counts toward max_tokens — keep effort low and leave room for the answer
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: sys, messages, output_config: { effort: "low" } }),
  });
  if (!r.ok) throw new Error("ai_" + r.status + ":" + (await r.text()).slice(0, 160));
  const out = await r.json();
  const text = (out.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").replace(/\*\*/g, "").replace(/^#+\s*/gm, "").trim();
  const it = out.usage?.input_tokens || 0, ot = out.usage?.output_tokens || 0;
  return { text, it, ot, usd: (it * 0.1 + ot * 0.5) / 1e6, model: out.model || MODEL, stop: out.stop_reason };
}
// retry once with a bigger budget if the model spent everything on thinking and returned no text
async function claudeText(sys: string, messages: unknown[], maxTokens: number) {
  let r = await claude(sys, messages, maxTokens);
  if (!r.text) { const r2 = await claude(sys, messages, maxTokens * 2); r2.it += r.it; r2.ot += r.ot; r2.usd += r.usd; r = r2; }
  if (!r.text) throw new Error("empty_reply:" + r.stop);
  return r;
}

async function makeSummary(admin: SupabaseClient, uid: string, lang: string) {
  const week = weekKey();
  const { data: ex } = await admin.from("coach_messages").select("id,body,week,created_at").eq("user_id", uid).eq("role", "summary").eq("week", week).maybeSingle();
  if (ex) return { summary: ex, cached: true };
  const d = await digest(admin, uid);
  if (!d.hasData) return { summary: null, empty: true };
  const ai = await claudeText(system(lang, "summary") + "\n\nUSER DATA DIGEST:\n" + d.text, [{ role: "user", content: "Write my weekly summary." }], 1200);
  await admin.from("ai_usage").insert({ user_id: uid, kind: "coach_summary", model: ai.model, input_tokens: ai.it, output_tokens: ai.ot, cost_usd: ai.usd });
  const { data: row, error } = await admin.from("coach_messages").insert({ user_id: uid, role: "summary", body: ai.text, week }).select("id,body,week,created_at").single();
  if (error) { // race: another call created it first
    const { data: again } = await admin.from("coach_messages").select("id,body,week,created_at").eq("user_id", uid).eq("role", "summary").eq("week", week).maybeSingle();
    return { summary: again, cached: true };
  }
  return { summary: row, cached: false };
}

const PUSH_T: Record<string, [string, string]> = {
  he: ["ראפי: הסיכום השבועי שלך 💬", "מה הלך טוב השבוע ועל מה להתמקד עכשיו"],
  ar: ["ريبي: ملخصك الأسبوعي 💬", "ما الذي سار جيدًا هذا الأسبوع وعلى ماذا تركّز الآن"],
  en: ["Repi: your weekly summary 💬", "What went well this week and what to focus on next"],
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));

  // ----- health check (cron key): one short real call to the model -----
  if (body.mode === "ping") {
    const { data: ck } = await admin.from("app_config").select("value").eq("key", "cron_key").maybeSingle();
    if (typeof ck?.value !== "string" || req.headers.get("x-cron-key") !== ck.value) return J({ error: "forbidden" }, 403);
    try { const r = await claudeText(system(body.lang || "he", "chat") + "\n\nUSER DATA DIGEST:\n(no data)", [{ role: "user", content: String(body.text || "איך עושים סקוואט?") }], 1500);
      return J({ ok: true, text: r.text, in: r.it, out: r.ot, usd: r.usd, stop: r.stop }); }
    catch (e) { return J({ ok: false, error: String(e).slice(0, 300) }, 502); }
  }

  // ----- cron: weekly summaries for active users -----
  if (body.mode === "weekly") {
    const { data: ck } = await admin.from("app_config").select("value").eq("key", "cron_key").maybeSingle();
    const CRON_KEY = typeof ck?.value === "string" ? ck.value : "";
    if (!CRON_KEY || req.headers.get("x-cron-key") !== CRON_KEY) return J({ error: "forbidden" }, 403);
    const week = weekKey();
    const since = Date.now() - 14 * 864e5;
    const { data: act } = await admin.from("workouts").select("user_id").gte("start_ts", since);
    // body.uids: specific users (trial day-5 summary) instead of everyone active
    const users = Array.isArray(body.uids) ? body.uids.filter((u: unknown) => typeof u === "string").slice(0, 50) : [...new Set((act || []).map((x: any) => x.user_id))];
    const { data: done } = await admin.from("coach_messages").select("user_id").eq("role", "summary").eq("week", week).in("user_id", users.length ? users : ["00000000-0000-0000-0000-000000000000"]);
    const doneSet = new Set((done || []).map((x: any) => x.user_id));
    const todo = users.filter((u) => !doneSet.has(u)).slice(0, Number(body.limit) || 25);
    let made = 0; const errs: string[] = [];
    for (const uid of todo) {
      try {
        const { data: ua } = await admin.from("user_access").select("status,trial_until,access_until").eq("user_id", uid).maybeSingle();
        const isAdm = !!(await admin.from("admins").select("user_id").eq("user_id", uid).maybeSingle()).data;
        const until = Math.max(new Date(ua?.trial_until || 0).getTime(), new Date(ua?.access_until || 0).getTime());
        if (!isAdm && (!ua || ua.status !== "approved" || until < Date.now())) continue;
        const { data: st } = await admin.from("settings").select("prefs").eq("user_id", uid).maybeSingle();
        const lang = ["he", "ar", "en"].includes((st as any)?.prefs?.lang) ? (st as any).prefs.lang : "he";
        const r = await makeSummary(admin, uid, lang);
        if (r.summary && !r.cached) {
          made++;
          const t = (st as any)?.prefs?.g === "f" && lang === "ar" ? [PUSH_T.ar[0], "ما الذي سار جيدًا هذا الأسبوع وعلى ماذا تركّزين الآن"] : PUSH_T[lang];
          if (!body.nopush && (st as any)?.prefs?.notif?.coach !== false) await admin.from("push_queue").insert({ user_id: uid, title: t[0], body: t[1], kind: "coach" });
        }
      } catch (e) { errs.push(String(e).slice(0, 120)); }
    }
    console.log(JSON.stringify({ ev: "coach-weekly", week, users: users.length, todo: todo.length, made, errs }));
    return J({ week, users: users.length, todo: todo.length, made, errs });
  }

  // ----- user calls -----
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return J({ error: "unauthorized" }, 401);
  const { data: plan } = await userClient.rpc("my_plan");
  if (!plan || plan.status !== "approved") return J({ error: "no_access" }, 403);
  const lang = ["he", "ar", "en"].includes(body.lang) ? body.lang : "he";

  try {
    if (body.mode === "summary") {
      if (!plan.premium && !plan.admin) return J({ error: "premium" }, 402);
      const r = await makeSummary(admin, user.id, lang);
      return J(r);
    }
    if (body.mode === "chat") {
      if (!plan.premium && !plan.admin) return J({ error: "premium" }, 402);
      const text = String(body.text || "").trim().slice(0, 500);
      if (!text) return J({ error: "bad_request" }, 400);
      const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("kind", "coach_chat").gte("created_at", new Date(Date.now() - 864e5).toISOString());
      if (!plan.admin && (count ?? 0) >= DAILY_CHAT) return J({ error: "quota", limit: DAILY_CHAT }, 429);
      const { data: hist } = await admin.from("coach_messages").select("role,body").eq("user_id", user.id).order("id", { ascending: false }).limit(6);
      const msgs: { role: string; content: string }[] = [];
      for (const h of (hist || []).reverse().filter((x: any) => (x.body || "").trim())) {
        const role = h.role === "user" ? "user" : "assistant";
        if (msgs.length && msgs[msgs.length - 1].role === role) msgs[msgs.length - 1].content += "\n\n" + h.body;
        else msgs.push({ role, content: h.body });
      }
      while (msgs.length && msgs[0].role !== "user") msgs.shift();
      if (msgs.length && msgs[msgs.length - 1].role === "user") msgs[msgs.length - 1].content += "\n\n" + text; else msgs.push({ role: "user", content: text });
      const d = await digest(admin, user.id);
      const ai = await claudeText(system(lang, "chat") + "\n\nUSER DATA DIGEST:\n" + d.text, msgs, 1500);
      await admin.from("ai_usage").insert({ user_id: user.id, kind: "coach_chat", model: ai.model, input_tokens: ai.it, output_tokens: ai.ot, cost_usd: ai.usd });
      await admin.from("coach_messages").insert([{ user_id: user.id, role: "user", body: text }, { user_id: user.id, role: "assistant", body: ai.text }]);
      console.log(JSON.stringify({ ev: "coach-chat", user: user.id.slice(0, 8), in: ai.it, out: ai.ot, usd: ai.usd, lang }));
      return J({ reply: ai.text, left: plan.admin ? null : DAILY_CHAT - (count ?? 0) - 1 });
    }
    return J({ error: "bad_mode" }, 400);
  } catch (e) {
    console.error(e);
    return J({ error: "ai_failed" }, 502);
  }
});
