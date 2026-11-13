// AI analysis of one opportunity. The AI judges meaning (intent, how well the
// work fits, what's missing), but the final score is still computed by the
// app from visible components, and the keyword-based hard caps still apply.
import "server-only";
import { chatJson } from "./client";
import { HONESTY_RULES, profileForPrompt } from "./rules";
import { bandFor, scoreOpportunity, type ScorableOpportunity } from "../matching/score";
import type { CandidateProfile, Intent, MatchResult, Preferences, RawOpportunity } from "../types";

interface AiOpportunityAnalysis {
  intent: Intent["label"];
  intent_reason: string;
  skills_alignment: number;   // 0..1
  experience_relevance: number; // 0..1
  level_fit: number;          // 0..1
  reasons: string[];
  gaps: string[];
  experience_fit: string;
  deliverable: string;
  extracted?: { company?: string | null; location?: string | null; work_arrangement?: string | null; budget?: string | null; skills?: string[]; contact?: string | null };
  credibility_notes?: string[];
}

const clamp = (n: unknown) => Math.max(0, Math.min(1, typeof n === "number" && Number.isFinite(n) ? n : 0));

export async function analyzeWithAi(raw: RawOpportunity, profile: CandidateProfile, prefs: Preferences): Promise<{ match: MatchResult; intent: Intent; extracted: AiOpportunityAnalysis["extracted"]; credibilityNotes: string[] }> {
  const system = `You evaluate job and freelance opportunities for one specific candidate. Be strict and realistic: matching keywords alone is not a good match.
${HONESTY_RULES}
Return JSON with keys: intent (one of "vacancy","hiring_request","recommendation_request","project_announcement","self_promotion","not_relevant"), intent_reason, skills_alignment (0-1), experience_relevance (0-1), level_fit (0-1), reasons (array of short strings citing the candidate's real projects/roles), gaps (array of missing skills or requirements), experience_fit (one sentence), deliverable (one sentence: can the candidate realistically deliver this work?), extracted {company, location, work_arrangement, budget, skills[], contact}, credibility_notes (array).
"self_promotion" means the poster is offering their own services rather than hiring.`;
  const user = `CANDIDATE PROFILE:\n${profileForPrompt(profile)}\n\nOPPORTUNITY (from ${raw.source}, ${raw.kind}):\nTitle: ${raw.title}\nPublisher: ${raw.publisher ?? "unknown"}\nLocation: ${raw.location ?? "unknown"}\nType: ${raw.employment_type ?? "unknown"}\nPay: ${raw.salary_text ?? "not disclosed"}\n\n${raw.description.slice(0, 5000)}`;
  const ai = await chatJson<AiOpportunityAnalysis>(system, user, { maxTokens: 1200 });

  // Deterministic baseline supplies location/type/pay and the hard caps.
  const base = scoreOpportunity(raw as ScorableOpportunity, profile, prefs, { mode: "ai" });
  const pick = (k: string) => base.components.find((c) => c.key === k)!;
  const components = [
    { ...pick("skills"), score: Math.round(35 * clamp(ai.skills_alignment)), note: `AI assessment. ${pick("skills").note}` },
    { ...pick("experience"), score: Math.round(20 * clamp(ai.experience_relevance)), note: ai.reasons?.[0] ?? pick("experience").note },
    { ...pick("level"), score: Math.round(15 * clamp(ai.level_fit)), note: ai.experience_fit || pick("level").note },
    pick("location"), pick("type"), pick("pay"),
  ];
  let score = components.reduce((n, c) => n + c.score, 0);
  const caps = [...base.caps];
  if (base.caps.some((c) => c.startsWith("Engineering-focused")) && score > 49) score = 49;
  // Keyword analysis found no overlap: AI may see a semantic fit, but not a strong one.
  if (base.caps.some((c) => c.startsWith("None of your skill areas")) && score > 64) {
    score = 64;
    caps.push("Capped: no direct skill overlap was found in the text.");
  }
  const gaps = [...new Set([...(ai.gaps ?? []), ...base.gaps])].slice(0, 8);
  const match: MatchResult = {
    score, band: bandFor(score), mode: "ai", components,
    reasons: (ai.reasons ?? []).slice(0, 6), gaps, caps,
    experience_fit: ai.experience_fit || base.experience_fit,
    deliverable: ai.deliverable || base.deliverable,
  };
  const intent: Intent = { label: ai.intent ?? "not_relevant", confidence: 0.8, mode: "ai", reason: ai.intent_reason ?? "" };
  return { match, intent, extracted: ai.extracted, credibilityNotes: ai.credibility_notes ?? [] };
}
