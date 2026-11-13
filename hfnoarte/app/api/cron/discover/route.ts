import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runDiscovery } from "@/lib/discovery/engine";
import { notifyMatches, sendReminders } from "@/lib/notify/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

// Scheduled discovery. Vercel Cron calls this daily with the CRON_SECRET;
// you can also call it from GitHub Actions or any scheduler.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const db = createAdminClient();
  const { data: users, error } = await db.from("preferences").select("user_id").eq("daily_discovery", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const { user_id } of users ?? []) {
    try {
      const summary = await runDiscovery(db, user_id, "cron");
      const { data: s } = await db.from("notification_settings").select("frequency, last_digest_at").eq("user_id", user_id).maybeSingle();
      const digestDue = s?.frequency === "daily" && (!s.last_digest_at || Date.now() - +new Date(s.last_digest_at) > 20 * 3600_000);
      const notified = await notifyMatches(db, user_id, { digestDue });
      const reminders = await sendReminders(db, user_id);
      results.push({ user: user_id.slice(0, 8), new: summary.newIds.length, found: summary.found, notified: notified.sent, reminders: reminders.sent, error: summary.error });
    } catch (e) {
      results.push({ user: user_id.slice(0, 8), error: (e as Error).message });
    }
  }
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), results });
}
