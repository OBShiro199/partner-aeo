// POST ?t=<unsubscribe_token>&k=weekly_digest|alerts -> { ok, what }
// Called by mail apps' one-click unsubscribe (RFC 8058 List-Unsubscribe-Post) and by the
// app's /unsubscribe page after the person presses the button. GET never unsubscribes,
// because inbox link scanners open every link they see.
import { admin, cors, json } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const kind = url.searchParams.get("k") === "alerts" ? "alerts" : "weekly_digest";
  if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ error: "This unsubscribe link is incomplete." }, 400);

  const { data, error } = await admin().from("email_preferences")
    .update({ [kind]: false, updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", token).select("user_id").maybeSingle();
  if (error || !data) return json({ error: "We couldn't find that subscription." }, 404);
  return json({ ok: true, what: kind });
});
