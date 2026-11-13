"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiAvailable } from "@/lib/ai/client";
import { analyzeWithAi } from "@/lib/ai/analyze";
import { loadPreferences, loadProfile } from "@/lib/data";
import { runDiscovery } from "@/lib/discovery/engine";
import { aiDrafts, templateDrafts } from "@/lib/drafts/generate";
import { detectIntent } from "@/lib/matching/intent";
import { scoreOpportunity } from "@/lib/matching/score";
import { notifyMatches } from "@/lib/notify/dispatch";
import { linkRow, opportunityRow } from "@/lib/opportunities";
import { SAMPLE_OPPORTUNITIES } from "@/lib/sample";
import { extractBudget, guessArrangement } from "@/lib/sources/http";
import { requireUser } from "@/lib/supabase/server";
import { importFromUrl } from "@/lib/url-import";
import { OPPORTUNITY_STATUSES, type OpportunityKind, type OpportunityStatus, type RawOpportunity } from "@/lib/types";

const refresh = () => revalidatePath("/", "layout");

export async function runDiscoveryNow() {
  const { supabase, user } = await requireUser();
  const summary = await runDiscovery(supabase, user.id, "manual");
  if (!summary.error) await notifyMatches(supabase, user.id, { digestDue: false });
  refresh();
  return summary;
}

async function analyse(raw: RawOpportunity, userId: string, supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const profile = await loadProfile(supabase, userId);
  if (!profile) return { error: "Set up your profile first." } as const;
  const prefs = await loadPreferences(supabase, userId);
  let match = scoreOpportunity(raw, profile, prefs);
  let intent = detectIntent(`${raw.title}\n${raw.description}`, { formal: raw.kind === "employment" });
  let note: string | undefined;
  if (aiAvailable()) {
    try { ({ match, intent } = await analyzeWithAi(raw, profile, prefs)); }
    catch (e) { note = `AI analysis failed (${(e as Error).message.slice(0, 100)}); keyword scoring was used.`; }
  }
  return { match, intent, note } as const;
}

async function save(raw: RawOpportunity, origin: "url" | "manual" | "sample") {
  const { supabase, user } = await requireUser();
  const a = await analyse(raw, user.id, supabase);
  if ("error" in a) return { error: a.error };
  const row = opportunityRow(user.id, raw, { match: a.match!, intent: a.intent! }, origin);
  const { data: existing } = await supabase.from("opportunities").select("id").eq("fingerprint", row.fingerprint).maybeSingle();
  if (existing) {
    if (raw.url) await supabase.from("opportunity_links").upsert([linkRow(user.id, existing.id, raw)], { onConflict: "user_id,url", ignoreDuplicates: true });
    return { id: existing.id, duplicate: true, note: a.note };
  }
  const { data, error } = await supabase.from("opportunities").insert({ ...row, status: "saved" }).select("id").single();
  if (error || !data) return { error: error?.message ?? "Could not save." };
  await supabase.from("opportunity_links").insert(linkRow(user.id, data.id, raw));
  refresh();
  return { id: data.id, note: a.note };
}

export async function addByUrl(_: unknown, f: FormData) {
  const url = String(f.get("url") ?? "").trim();
  if (!url) return { error: "Paste a link first." };
  const r = await importFromUrl(url);
  if (!r.ok || !r.item) return { error: r.reason ?? "Couldn't read that page.", manual: true, url };
  const saved = await save(r.item, "url");
  if ("error" in saved && saved.error) return { error: saved.error };
  redirect(`/opportunities/${saved.id}${saved.duplicate ? "?duplicate=1" : ""}`);
}

export async function addManual(_: unknown, f: FormData) {
  const g = (k: string) => String(f.get(k) ?? "").trim();
  if (!g("title") || !g("description")) return { error: "Add at least a title and description." };
  const kind = (["employment", "freelance", "social"].includes(g("kind")) ? g("kind") : "employment") as OpportunityKind;
  const budget = g("salary") ? extractBudget(g("salary")) : null;
  const url = g("url");
  const raw: RawOpportunity = {
    source: url ? "url" : "manual", url: url && /^https?:\/\//.test(url) ? url : null, kind,
    title: g("title"), description: g("description"), company: g("company") || null, publisher: g("publisher") || g("company") || null,
    location: g("location") || null, work_arrangement: (g("work_arrangement") || guessArrangement(g("location"))) as RawOpportunity["work_arrangement"],
    employment_type: g("employment_type") || null, salary_text: g("salary") || null,
    salary_min: budget?.min ?? null, salary_max: budget?.max ?? null, currency: budget?.currency ?? null,
    published_at: g("published_at") ? new Date(g("published_at")).toISOString() : null,
    access_method: "Entered manually",
  };
  const saved = await save(raw, "manual");
  if ("error" in saved && saved.error) return { error: saved.error };
  redirect(`/opportunities/${saved.id}`);
}

export async function loadSamples() {
  const { supabase, user } = await requireUser();
  const profile = await loadProfile(supabase, user.id);
  if (!profile) return { error: "Set up your profile first." };
  const prefs = await loadPreferences(supabase, user.id);
  const rows = SAMPLE_OPPORTUNITIES.map((s) => opportunityRow(user.id, s, {
    match: scoreOpportunity(s, profile, prefs), intent: detectIntent(`${s.title}\n${s.description}`, { formal: s.kind === "employment" }),
  }, "sample"));
  await supabase.from("opportunities").upsert(rows, { onConflict: "user_id,fingerprint", ignoreDuplicates: true });
  refresh();
  return { ok: true };
}

export async function clearSamples() {
  const { supabase } = await requireUser();
  await supabase.from("opportunities").delete().eq("is_sample", true);
  refresh();
}

export async function setStatus(id: string, status: OpportunityStatus) {
  if (!OPPORTUNITY_STATUSES.includes(status)) return { error: "Unknown status" };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("opportunities").update({ status }).eq("id", id);
  refresh();
  if (error) return { error: /approval/i.test(error.message) ? "Approve this application in Review & Approve first. hfNoArte won't record it as applied or contacted without your approval." : error.message };
  return { ok: true };
}

export async function saveTracking(id: string, data: { notes?: string; follow_up_date?: string | null; interview_at?: string | null; interview_notes?: string; documents?: { label: string; url: string }[]; applied_at?: string | null }) {
  const { supabase } = await requireUser();
  const docs = data.documents?.filter((d) => d.label && /^https?:\/\//.test(d.url)).slice(0, 20);
  const { error } = await supabase.from("opportunities").update({
    notes: data.notes?.slice(0, 10_000) ?? undefined,
    follow_up_date: data.follow_up_date || null,
    interview_at: data.interview_at ? new Date(data.interview_at).toISOString() : null,
    interview_notes: data.interview_notes?.slice(0, 5000) ?? undefined,
    ...(docs ? { documents: docs } : {}),
    ...(data.applied_at !== undefined ? { applied_at: data.applied_at ? new Date(data.applied_at).toISOString() : null } : {}),
  }).eq("id", id);
  refresh();
  return error ? { error: error.message } : { ok: true };
}

export async function deleteOpportunity(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("opportunities").delete().eq("id", id);
  refresh();
  redirect("/opportunities");
}

/** Prepare application material; every draft goes to the review queue. */
export async function prepareMaterial(id: string) {
  const { supabase, user } = await requireUser();
  const { data: o } = await supabase.from("opportunities").select("id, kind, title, description, company, publisher, status").eq("id", id).single();
  if (!o) return { error: "Opportunity not found." };
  const profile = await loadProfile(supabase, user.id);
  if (!profile) return { error: "Set up your profile first." };
  let drafts;
  let note: string | undefined;
  if (aiAvailable()) {
    try { drafts = await aiDrafts(o, profile); }
    catch (e) { note = `AI was unavailable (${(e as Error).message.slice(0, 100)}), so honest templates were used instead.`; }
  }
  drafts ??= templateDrafts(o, profile);
  // Replace earlier unapproved drafts; keep anything already approved.
  await supabase.from("drafts").delete().eq("opportunity_id", id).in("review_state", ["draft", "pending_review", "rejected"]);
  const { error } = await supabase.from("drafts").insert(drafts.map((d) => ({
    user_id: user.id, opportunity_id: id, kind: d.kind, title: d.title, content: d.content,
    review_state: "pending_review", generated_mode: d.mode, warnings: d.warnings,
  })));
  if (error) return { error: error.message };
  if (["new", "saved", "reviewing", "interested"].includes(o.status)) await supabase.from("opportunities").update({ status: "message_prepared" }).eq("id", id);
  refresh();
  return { ok: true, mode: drafts[0]?.mode, note };
}

export async function rescore(id: string) {
  const { supabase, user } = await requireUser();
  const { data: o } = await supabase.from("opportunities").select("*, opportunity_links(source, url, access_method)").eq("id", id).single();
  if (!o) return { error: "Not found" };
  const raw: RawOpportunity = { ...o, source: o.opportunity_links?.[0]?.source ?? "manual", url: o.opportunity_links?.[0]?.url ?? null, access_method: "" };
  const a = await analyse(raw, user.id, supabase);
  if ("error" in a) return { error: a.error };
  await supabase.from("opportunities").update({ match: a.match, match_score: a.match!.score, match_band: a.match!.band, intent: a.intent, analysis_mode: a.match!.mode }).eq("id", id);
  refresh();
  return { ok: true, note: a.note };
}
