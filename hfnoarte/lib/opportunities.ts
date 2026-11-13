import { assessCredibility } from "./matching/credibility";
import { fingerprint, canonicalUrl } from "./dedupe";
import type { Credibility, Intent, MatchResult, RawOpportunity } from "./types";

/** Build an `opportunities` row from a raw item and its analysis. */
export function opportunityRow(
  userId: string,
  raw: RawOpportunity,
  analysis: { match: MatchResult; intent: Intent; credibility?: Credibility },
  origin: "discovery" | "url" | "manual" | "sample" = "discovery",
  now = new Date(),
) {
  const published = raw.published_at ? new Date(raw.published_at) : null;
  const ageDays = published ? (+now - +published) / 86_400_000 : null;
  const stale = ageDays != null && ageDays > (raw.kind === "social" ? 30 : 45);
  return {
    user_id: userId,
    fingerprint: fingerprint(raw),
    kind: raw.kind,
    title: raw.title.slice(0, 300) || "Untitled opportunity",
    description: raw.description,
    company: raw.company ?? null,
    publisher: raw.publisher ?? null,
    publisher_url: raw.publisher_url ?? null,
    location: raw.location ?? null,
    work_arrangement: raw.work_arrangement ?? null,
    employment_type: raw.employment_type ?? null,
    salary_text: raw.salary_text ?? null,
    salary_min: raw.salary_min ?? null,
    salary_max: raw.salary_max ?? null,
    currency: raw.currency ?? null,
    skills: raw.tags?.filter((t) => !t.startsWith("r/") && t !== "reply").slice(0, 15) ?? [],
    published_at: raw.published_at ?? null,
    is_active: stale ? false : null,
    activity_note: stale ? `Posted ${Math.round(ageDays!)} days ago — may no longer be open.` : null,
    is_sample: origin === "sample",
    origin,
    match: analysis.match,
    match_score: analysis.match.score,
    match_band: analysis.match.band,
    credibility: analysis.credibility ?? assessCredibility(raw, { now }),
    intent: analysis.intent,
    analysis_mode: analysis.match.mode,
  };
}

export function linkRow(userId: string, opportunityId: string, raw: RawOpportunity) {
  return {
    user_id: userId,
    opportunity_id: opportunityId,
    source: raw.source,
    url: canonicalUrl(raw.url) ?? raw.url,
    external_id: raw.external_id ?? null,
    author: raw.publisher ?? null,
    author_url: raw.publisher_url ?? null,
    published_at: raw.published_at ?? null,
    access_method: raw.access_method,
  };
}
