// NextRep: the signed-in user deletes their own account (App Store 5.1.1(v) / Google Play account deletion).
// Removes every row the user owns (all tables reference auth.users with ON DELETE CASCADE), their group posts,
// their progress photos in storage, and the auth user itself. Rows other people still need (groups and challenges
// the user created, payment records kept for accounting) are kept but detached from the user (= null).
// Store subscriptions are billed by Apple / Google: the app tells the user to cancel there.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return J({ error: "method" }, 405);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return J({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "DELETE") return J({ error: "confirm" }, 400);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  // an admin may delete another user's account (never another admin, never themself through this path)
  let uid = user.id;
  if (body.uid && body.uid !== user.id) {
    const { data: me } = await admin.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!me) return J({ error: "forbidden" }, 403);
    const { data: other } = await admin.from("admins").select("user_id").eq("user_id", body.uid).maybeSingle();
    if (other) return J({ error: "target_admin" }, 400);
    uid = String(body.uid);
  }
  const steps: Record<string, string> = {};
  const run = async (name: string, f: () => Promise<{ error: unknown } | unknown>) => {
    try { const r: any = await f(); steps[name] = r?.error ? "err:" + String(r.error.message || r.error).slice(0, 80) : "ok"; }
    catch (e) { steps[name] = "err:" + String(e).slice(0, 80); }
  };
  // keep what other people need, detached from this user
  await run("group_messages", () => admin.from("group_messages").delete().eq("user_id", uid)); // their own posts go with them
  await run("groups", () => admin.from("groups").update({ created_by: null }).eq("created_by", uid));
  await run("challenges", () => admin.from("challenges").update({ created_by: null }).eq("created_by", uid));
  await run("payments", () => admin.from("payments").update({ user_id: null }).eq("user_id", uid));
  await run("challenge_done", () => admin.from("challenge_done").delete().eq("user_id", uid));
  // progress photos (private bucket, one folder per user)
  await run("photos", async () => {
    let n = 0;
    for (let i = 0; i < 20; i++) {
      const { data, error } = await admin.storage.from("progress").list(uid, { limit: 1000 });
      if (error) return { error };
      if (!data?.length) break;
      const { error: e2 } = await admin.storage.from("progress").remove(data.map((f) => `${uid}/${f.name}`));
      if (e2) return { error: e2 };
      n += data.length;
    }
    steps.photos_n = String(n);
    return {};
  });
  // the account itself; every other table cascades from here
  const { error } = await admin.auth.admin.deleteUser(uid);
  console.log(JSON.stringify({ ev: "account-deleted", user: uid.slice(0, 8), by: uid === user.id ? "self" : "admin", ok: !error, steps }));
  if (error) return J({ error: "delete_failed", detail: String(error.message || error).slice(0, 200), steps }, 500);
  return J({ ok: true });
});
