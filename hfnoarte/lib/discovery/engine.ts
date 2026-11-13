// The discovery engine: run every enabled source, understand each item,
// drop what isn't a real opportunity, merge duplicates, score, and save —
// recording exactly what was searched and what happened.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiAvailable } from "../ai/client";
import { analyzeWithAi } from "../ai/analyze";
import { loadPreferences, loadProfile } from "../data";
import { fingerprint, groupDuplicates } from "../dedupe";
import { assessCredibility } from "../matching/credibility";
import { detectIntent, isOpportunityIntent } from "../matching/intent";
import { scoreOpportunity } from "../matching/score";
import { linkRow, opportunityRow } from "../opportunities";
import { SOURCES } from "../sources";
import type { SearchResult } from "../sources/types";
import type { Intent, MatchResult, RawOpportunity } from "../types";
import { buildPlan } from "./plan";

const AI_LIMIT = Number(process.env.AI_ANALYSIS_LIMIT || 12);

export interface DiscoverySummary {
  runId: string | null;
  found: number;
  kept: number;
  newIds: string[];
  merged: number;
  mode: "ai" | "keyword" | "mixed";
  sources: { id: string; status: string; found: number; kept: number; message?: string }[];
  error?: string;
}

interface Candidate { raw: RawOpportunity; dupes: RawOpportunity[]; match: MatchResult; intent: Intent }

export async function runDiscovery(db: SupabaseClient, userId: string, trigger: "cron" | "manual", now = new Date()): Promise<DiscoverySummary> {
  const profile = await loadProfile(db, userId);
  if (!profile) return { runId: null, found: 0, kept: 0, newIds: [], merged: 0, mode: "keyword", sources: [], error: "Set up your profile before searching." };
  const prefs = await loadPreferences(db, userId);
  const plan = buildPlan(profile, prefs);

  const { data: run } = await db.from("discovery_runs").insert({ user_id: userId, trigger }).select("id").single();
  const runId: string | null = run?.id ?? null;

  const enabled = SOURCES.filter((s) => s.search && (!prefs.enabled_sources || prefs.enabled_sources.includes(s.id)));
  const runnable = enabled.filter((s) => {
    const st = s.availability().state;
    return st === "ready" || st === "limited";
  });

  // 1. Search every source in parallel; one failing never stops the others.
  const started = new Date().toISOString();
  const results = await Promise.all(runnable.map(async (s): Promise<[string, SearchResult]> => {
    try {
      return [s.id, await s.search!({ plan, prefs, now })];
    } catch (e) {
      return [s.id, { items: [], status: "failed", message: (e as Error).message, queries: [] }];
    }
  }));

  // 2. Understand and filter.
  const excluded = prefs.excluded_keywords.map((k) => k.toLowerCase()).filter(Boolean);
  const perSourceKept = new Map<string, number>();
  const all: RawOpportunity[] = results.flatMap(([, r]) => r.items);
  const groups = groupDuplicates(all);
  const candidates: Candidate[] = [];
  for (const [, items] of groups) {
    const raw = items[0];
    const text = `${raw.title}\n${raw.description}`;
    if (!prefs.opportunity_kinds.includes(raw.kind)) continue;
    if (raw.employment_type === "internship" && !prefs.include_internships) continue;
    if (excluded.some((k) => text.toLowerCase().includes(k))) continue;
    const age = raw.published_at ? (+now - +new Date(raw.published_at)) / 86_400_000 : null;
    if (age != null && age > (raw.kind === "social" ? 30 : 60)) continue;

    const intent = detectIntent(text, { formal: raw.kind === "employment" && !raw.source_hint, sourceHint: raw.source_hint });
    if (!isOpportunityIntent(intent)) continue;
    const match = scoreOpportunity(raw, profile, prefs, { now });
    if (match.band === "poor") continue;
    candidates.push({ raw, dupes: items.slice(1), match, intent });
  }

  // 3. Skip what's already saved; record new source links on existing records.
  const fps = candidates.map((c) => fingerprint(c.raw));
  const existing = new Map<string, string>();
  for (let i = 0; i < fps.length; i += 200) {
    const { data } = await db.from("opportunities").select("id, fingerprint").eq("user_id", userId).in("fingerprint", fps.slice(i, i + 200));
    for (const r of data ?? []) existing.set(r.fingerprint, r.id);
  }
  let merged = 0;
  const fresh: Candidate[] = [];
  for (const c of candidates) {
    const id = existing.get(fingerprint(c.raw));
    if (id) {
      const links = [c.raw, ...c.dupes].filter((r) => r.url).map((r) => linkRow(userId, id, r));
      if (links.length) {
        const { data } = await db.from("opportunity_links").upsert(links, { onConflict: "user_id,url", ignoreDuplicates: true }).select("id");
        if (data?.length) merged++;
      }
    } else fresh.push(c);
  }

  // 4. AI analysis for the most promising new items (free tiers are rate-limited).
  let aiUsed = 0;
  let aiFailed = 0;
  if (aiAvailable()) {
    fresh.sort((a, b) => b.match.score - a.match.score);
    for (const c of fresh.slice(0, AI_LIMIT)) {
      try {
        const r = await analyzeWithAi(c.raw, profile, prefs);
        c.match = r.match;
        c.intent = r.intent;
        aiUsed++;
      } catch {
        aiFailed++;
        if (aiFailed >= 3) break;
      }
    }
  }
  const finalists = fresh.filter((c) => isOpportunityIntent(c.intent) && c.match.band !== "poor");

  // 5. Save.
  const newIds: string[] = [];
  for (const c of finalists) {
    const row = opportunityRow(userId, c.raw, {
      match: c.match, intent: c.intent, credibility: assessCredibility(c.raw, { duplicates: c.dupes.length + 1, now }),
    }, "discovery", now);
    const { data, error } = await db.from("opportunities").insert(row).select("id").single();
    if (error || !data) continue;
    newIds.push(data.id);
    const links = [c.raw, ...c.dupes].filter((r) => r.url).map((r) => linkRow(userId, data.id, r));
    if (links.length) await db.from("opportunity_links").upsert(links, { onConflict: "user_id,url", ignoreDuplicates: true });
    for (const r of [c.raw, ...c.dupes]) perSourceKept.set(r.source, (perSourceKept.get(r.source) ?? 0) + 1);
  }

  // 6. Mark untouched old items as expired.
  const cutoff = new Date(+now - 45 * 86_400_000).toISOString();
  await db.from("opportunities").update({ status: "expired", is_active: false, activity_note: "Older than 45 days and never acted on." })
    .eq("user_id", userId).eq("status", "new").lt("published_at", cutoff);

  // 7. Record what each source did.
  const finished = new Date().toISOString();
  const sourceRows = results.map(([id, r]) => ({
    user_id: userId, run_id: runId, source: id, status: r.status, queries: r.queries.slice(0, 20),
    found: r.items.length, kept: perSourceKept.get(id) ?? 0, message: r.message ?? null, started_at: started, finished_at: finished,
  }));
  if (sourceRows.length) await db.from("source_runs").insert(sourceRows);

  const mode = aiUsed === 0 ? "keyword" : aiUsed >= finalists.length ? "ai" : "mixed";
  if (runId) {
    await db.from("discovery_runs").update({
      status: "completed", finished_at: finished, found: all.length, new_count: newIds.length, merged_count: merged,
      analysis_mode: mode, error: aiFailed ? `AI analysis failed for ${aiFailed} item(s); keyword scoring used instead.` : null,
    }).eq("id", runId);
  }

  return {
    runId, found: all.length, kept: finalists.length, newIds, merged, mode,
    sources: results.map(([id, r]) => ({ id, status: r.status, found: r.items.length, kept: perSourceKept.get(id) ?? 0, message: r.message })),
  };
}
