// NextRep — the morning message for web-push users, in each user's language (settings.prefs.lang).
// One message a day: the weekly photo day and/or the scheduled workout, with the weigh-in folded in when not weighed yet.
// A plain weigh-in morning is sent by public.weigh_reminders(), which skips the users this function covers.
// Users with the installed app get the same message as a local notification from the app, so they are skipped here.
// Auth: x-cron-key header (value in app_config 'cron_key'; called by pg_cron), hence verify_jwt=false.
// VAPID private key: Edge Function secret VAPID_PRIVATE_KEY (never in code).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC = "BEZW8tXMc6pOHrP87-KW8pfmZvr1ueA7S7BqBzUQu-Hp2DC_Yi2B-K_yO7JxWeRClXUDK6K1AsMETaQpvY-hkXw";
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type T3 = [string, string];
const TXT: Record<string, Record<string, T3>> = {
  he: { photoW: ["בוקר טוב ☀️ היום יום צילום", "שקילה, 3 תמונות והאימון 💪 קודם התמונות, לפני האוכל."], photo: ["בוקר טוב, היום יום צילום 📸", "שקילה ו-3 תמונות (חזית, גב וצד), לפני האוכל. לוקח 2 דקות."],
    photoNoWeigh: ["היום יום צילום 📸", "3 תמונות: חזית, גב וצד. הבקרה השבועית שלך."], weighW: ["היום יום אימון 💪", "קודם שקילה לפני האוכל, ואז ניפגש באימון."], workout: ["היום יום אימון 💪", "האימון מחכה לך ב-NextRep."] },
  ar: { photoW: ["صباح الخير ☀️ اليوم يوم التصوير", "الوزن و3 صور والتمرين 💪 الصور أولًا، قبل الأكل."], photo: ["صباح الخير، اليوم يوم التصوير 📸", "الوزن و3 صور (أمام، خلف، جانب) قبل الأكل. دقيقتان فقط."],
    photoNoWeigh: ["اليوم يوم التصوير 📸", "3 صور: أمام وخلف وجانب. متابعتك الأسبوعية."], weighW: ["اليوم يوم تدريب 💪", "أولًا الوزن قبل الأكل، ثم نلتقي في التمرين."], workout: ["اليوم يوم تدريب 💪", "تمرينك بانتظارك في NextRep."] },
  en: { photoW: ["Good morning ☀️ It's photo day", "Weigh-in, 3 photos and your workout 💪 Photos first, before eating."], photo: ["Good morning, it's photo day 📸", "Weigh-in and 3 photos (front, back, side) before eating. Takes 2 minutes."],
    photoNoWeigh: ["Photo day today 📸", "3 photos: front, back and side. Your weekly check-in."], weighW: ["Workout day today 💪", "Weigh in first, before eating, then see you at the workout."], workout: ["Workout day today 💪", "Your workout is waiting in NextRep."] },
};

Deno.serve(async (req: Request) => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ck } = await sb.from("app_config").select("value").eq("key", "cron_key").maybeSingle();
  if (typeof ck?.value !== "string" || req.headers.get("x-cron-key") !== ck.value) return new Response("forbidden", { status: 403 });
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!priv) { console.log(JSON.stringify({ ev: "daily-reminder", err: "no VAPID_PRIVATE_KEY" })); return new Response("no_key", { status: 500 }); }
  webpush.setVapidDetails("mailto:ofek4business@gmail.com", VAPID_PUBLIC, priv);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short" }).format(new Date());
  const dow = DOW[wd] ?? new Date().getDay();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const { data: rows, error } = await sb.from("settings").select("user_id,prefs");
  if (error) return new Response(error.message, { status: 500 });
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const [{ data: nat }, { data: bw }] = await Promise.all([
    sb.from("native_push").select("user_id").gt("updated_at", since),
    sb.from("bodyweight").select("user_id").eq("d", today),
  ]);
  const native = new Set((nat || []).map((x: any) => x.user_id)), weighed = new Set((bw || []).map((x: any) => x.user_id));

  const msgs = new Map<string, { title: string; body: string }>();
  for (const r of rows || []) {
    const uid = (r as any).user_id, p = (r as any).prefs || {};
    if (native.has(uid)) continue; // the app sends this one itself
    const workout = p.notif?.remind === true && !!p.schedule?.[String(dow)];
    const weighOn = p.notif?.weigh !== false, weigh = weighOn && !weighed.has(uid);
    const photo = p.photoDay != null && Number(p.photoDay) === dow && (weighOn || p.notif?.remind === true);
    if (!workout && !photo) continue;
    const T = TXT[p.lang] || TXT.he;
    const [title, body] = photo ? (workout ? T.photoW : weigh ? T.photo : T.photoNoWeigh) : weigh ? T.weighW : T.workout;
    msgs.set(uid, { title, body });
  }
  if (!msgs.size) return Response.json({ sent: 0, dow });

  const { data: subs } = await sb.from("push_subs").select("endpoint,user_id,keys").in("user_id", [...msgs.keys()]);
  let sent = 0;
  for (const s of subs || []) {
    const m = msgs.get((s as any).user_id); if (!m) continue;
    try {
      await webpush.sendNotification({ endpoint: (s as any).endpoint, keys: (s as any).keys }, JSON.stringify(m));
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode;
      if (code === 404 || code === 410) await sb.from("push_subs").delete().eq("endpoint", (s as any).endpoint);
    }
  }
  console.log(JSON.stringify({ ev: "daily-reminder", dow, users: msgs.size, sent }));
  return Response.json({ sent, dow });
});
