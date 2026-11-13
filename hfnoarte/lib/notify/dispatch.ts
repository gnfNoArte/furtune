// Decide what to tell the candidate after a discovery run, and send it.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appUrl } from "../env";
import type { MatchBand, MatchResult } from "../types";
import { deliver, type ChannelSettings } from "./channels";
import { composeMatches, composeReminder, type NotifyOpportunity } from "./compose";

const BAND_ORDER: MatchBand[] = ["poor", "stretch", "reasonable", "strong"];
const meets = (band: string | null, min: string) => !!band && BAND_ORDER.indexOf(band as MatchBand) >= BAND_ORDER.indexOf(min as MatchBand);

interface Settings extends ChannelSettings { frequency: "instant" | "daily" | "off"; min_band: string; reminders_enabled: boolean; last_digest_at: string | null }

async function settingsFor(db: SupabaseClient, userId: string): Promise<Settings | null> {
  const { data } = await db.from("notification_settings").select("*").eq("user_id", userId).maybeSingle();
  return data as Settings | null;
}

async function loadForNotify(db: SupabaseClient, userId: string, filter: (q: any) => any): Promise<NotifyOpportunity[]> {
  const { data } = await filter(
    db.from("opportunities")
      .select("id, title, description, company, publisher, discovered_at, match, match_score, match_band, is_sample, opportunity_links(source, url)")
      .eq("user_id", userId).is("notified_at", null).eq("is_sample", false),
  );
  return ((data ?? []) as any[]).map((o) => ({
    id: o.id, title: o.title, description: o.description, company: o.company, publisher: o.publisher,
    discovered_at: o.discovered_at, match: o.match as MatchResult, match_score: o.match_score, band: o.match_band,
    source: o.opportunity_links?.[0]?.source ?? "manual", url: o.opportunity_links?.[0]?.url ?? null,
  }));
}

async function record(db: SupabaseClient, userId: string, kind: string, title: string, body: string, link: string | null, channels: Record<string, string>, opportunityId?: string) {
  await db.from("notifications").insert({ user_id: userId, kind, title, body, link, channels, opportunity_id: opportunityId ?? null });
}

/** After discovery: instant alerts, or the daily digest when it's due. */
export async function notifyMatches(db: SupabaseClient, userId: string, opts: { digestDue: boolean }) {
  const s = await settingsFor(db, userId);
  if (!s || s.frequency === "off") return { sent: 0 };
  if (s.frequency === "daily" && !opts.digestDue) return { sent: 0 };

  const items = (await loadForNotify(db, userId, (q) => q.order("match_score", { ascending: false }).limit(50)))
    .filter((o) => meets((o as any).band, s.min_band));
  if (!items.length) return { sent: 0 };
  const top = items.slice(0, s.frequency === "instant" ? 10 : 15);
  const base = appUrl();

  if (s.frequency === "instant" && top.length <= 3) {
    for (const o of top) {
      const msg = composeMatches([o], base, false);
      const channels = await deliver(s, msg);
      await record(db, userId, "new_match", msg.subject, msg.text, o.url, channels, o.id);
    }
  } else {
    const msg = composeMatches(top, base, s.frequency === "daily");
    const channels = await deliver(s, msg);
    await record(db, userId, s.frequency === "daily" ? "digest" : "new_match", msg.subject, msg.text, `${base}/opportunities`, channels);
  }
  await db.from("opportunities").update({ notified_at: new Date().toISOString() }).eq("user_id", userId).in("id", items.map((o) => o.id));
  if (s.frequency === "daily") await db.from("notification_settings").update({ last_digest_at: new Date().toISOString() }).eq("user_id", userId);
  return { sent: top.length };
}

/** Follow-up dates due today and interviews in the next 24 hours. */
export async function sendReminders(db: SupabaseClient, userId: string, now = new Date()) {
  const s = await settingsFor(db, userId);
  if (!s || !s.reminders_enabled) return { sent: 0 };
  const today = now.toISOString().slice(0, 10);
  const since = new Date(+now - 20 * 3600_000).toISOString();
  const { data: already } = await db.from("notifications").select("opportunity_id, kind").eq("user_id", userId).in("kind", ["follow_up", "interview"]).gte("created_at", since);
  const done = new Set((already ?? []).map((r) => `${r.kind}:${r.opportunity_id}`));
  const base = appUrl();
  let sent = 0;

  const { data: follow } = await db.from("opportunities").select("id, title, company, publisher, status")
    .eq("user_id", userId).lte("follow_up_date", today).not("status", "in", "(won,rejected,expired)");
  for (const o of follow ?? []) {
    if (done.has(`follow_up:${o.id}`)) continue;
    const msg = composeReminder(`Follow up: ${o.title}`, [`${o.company ?? o.publisher ?? ""} — status: ${o.status.replace("_", " ")}.`, "Your follow-up date has arrived."], base, `/opportunities/${o.id}`);
    await record(db, userId, "follow_up", msg.subject, msg.text, `${base}/opportunities/${o.id}`, await deliver(s, msg), o.id);
    sent++;
  }

  const soon = new Date(+now + 24 * 3600_000).toISOString();
  const { data: interviews } = await db.from("opportunities").select("id, title, company, interview_at, interview_notes")
    .eq("user_id", userId).gte("interview_at", now.toISOString()).lte("interview_at", soon);
  for (const o of interviews ?? []) {
    if (done.has(`interview:${o.id}`)) continue;
    const msg = composeReminder(`Interview soon: ${o.title}`, [`${o.company ?? ""} — ${new Date(o.interview_at).toUTCString()}`, o.interview_notes ?? ""].filter(Boolean), base, `/opportunities/${o.id}`);
    await record(db, userId, "interview", msg.subject, msg.text, `${base}/opportunities/${o.id}`, await deliver(s, msg), o.id);
    sent++;
  }
  return { sent };
}
