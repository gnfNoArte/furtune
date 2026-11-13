// Explainable relevance scoring.
//
// The score is the sum of seven visible components. Keyword hits alone cannot
// produce a high score: coverage is measured against everything the posting
// asks for (including skills the candidate lacks), the job title must be
// relevant, and engineering-heavy roles are capped.

import { candidateClusters, candidateLevel, evidenceFor, hasLeadRole } from "../candidate/clusters";
import { CODE_HEAVY, ENGINEERING_TITLE, NO_CODE_TITLE, clusterLabel, clustersIn } from "../taxonomy";
import type { AnalysisMode, CandidateProfile, MatchBand, MatchComponent, MatchResult, Preferences, RawOpportunity } from "../types";

export type ScorableOpportunity = Pick<
  RawOpportunity,
  "title" | "description" | "kind" | "location" | "work_arrangement" | "employment_type" | "salary_min" | "salary_max" | "currency"
> & { skills?: string[] };

export const bandFor = (score: number): MatchBand =>
  score >= 75 ? "strong" : score >= 55 ? "reasonable" : score >= 35 ? "stretch" : "poor";

export const BAND_LABELS: Record<MatchBand, string> = {
  strong: "Strong match", reasonable: "Reasonable match", stretch: "Stretch opportunity", poor: "Poor match",
};

const DESIGNISH_TITLE = /\b(design|designer|creative|brand|visual|ux|ui|web|website|webflow|framer|shopify|no[- ]?code|product|annotat|ai trainer|evaluator|web3|crypto)\b/i;

export interface Analysis {
  requested: Set<string>;
  matched: Set<string>;
  missing: Set<string>;
  titleClusters: Set<string>;
  titleRelevance: number;
  codeHeavyRole: boolean;
  yearsRequired: number | null;
  seniority: "intern" | "junior" | "mid" | "senior" | "lead" | null;
}

export function analyse(o: ScorableOpportunity, p: CandidateProfile): Analysis {
  const have = candidateClusters(p);
  const title = o.title ?? "";
  const body = `${o.description ?? ""} ${(o.skills ?? []).join(" ")}`;
  const titleClusters = clustersIn(title);
  const requested = new Set([...titleClusters, ...clustersIn(body)]);
  // Website builders imply website design work.
  if (requested.has("webflow") || requested.has("framer") || requested.has("shopify")) requested.add("web_design");

  const matched = new Set([...requested].filter((c) => have.has(c)));
  const missing = new Set([...requested].filter((c) => !have.has(c)));

  const titleMatches = [...titleClusters].filter((c) => have.has(c)).length;
  const engineeringTitle = ENGINEERING_TITLE.test(title) && !NO_CODE_TITLE.test(title);
  let titleRelevance = titleMatches > 0 ? 1 : DESIGNISH_TITLE.test(title) ? 0.55 : 0.2;
  if (engineeringTitle) titleRelevance = Math.min(titleRelevance, 0.15);

  const missingCode = [...missing].filter((c) => CODE_HEAVY.has(c));
  const codeHeavyRole = engineeringTitle || (missingCode.length >= 2 && !NO_CODE_TITLE.test(`${title} ${body}`));

  const yrs = /(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years|yrs)/i.exec(`${title} ${body}`);
  const yearsRequired = yrs ? Number(yrs[1]) : null;

  const s = title.toLowerCase();
  const seniority =
    /\bintern(ship)?\b/.test(s) ? "intern"
    : /\b(junior|jr\.?|entry[- ]level|graduate|trainee)\b/.test(s) ? "junior"
    : /\b(lead|head of|principal|staff|director)\b/.test(s) ? "lead"
    : /\b(senior|sr\.?)\b/.test(s) ? "senior"
    : /\b(mid[- ]?level|intermediate)\b/.test(s) ? "mid"
    : null;

  return { requested, matched, missing, titleClusters, titleRelevance, codeHeavyRole, yearsRequired, seniority };
}

const inList = (value: string | null | undefined, list: string[]) =>
  !!value && list.some((l) => value.toLowerCase().includes(l.toLowerCase()) || l.toLowerCase().includes(value.toLowerCase()));

export function scoreOpportunity(
  o: ScorableOpportunity,
  p: CandidateProfile,
  prefs: Preferences,
  opts: { mode?: AnalysisMode; now?: Date } = {},
): MatchResult {
  const a = analyse(o, p);
  const reasons: string[] = [];
  const gaps: string[] = [];
  const caps: string[] = [];
  const components: MatchComponent[] = [];
  const lvl = candidateLevel(p, opts.now);

  // 1. Skill alignment (35)
  const missingCode = [...a.missing].filter((c) => CODE_HEAVY.has(c));
  const missingOther = [...a.missing].filter((c) => !CODE_HEAVY.has(c));
  const denom = a.matched.size + missingCode.length + missingOther.length * 0.5;
  const coverage = denom === 0 ? 0.35 : a.matched.size / denom;
  const skillScore = Math.round(35 * (0.55 * coverage + 0.45 * a.titleRelevance));
  components.push({
    key: "skills", label: "Skill alignment", score: skillScore, max: 35,
    note: denom === 0
      ? "The posting names few specific skills."
      : `Matches ${a.matched.size} of ${a.requested.size} skill areas it mentions.`,
  });
  if (a.matched.size) reasons.push(`Asks for ${[...a.matched].map(clusterLabel).join(", ")}, which you have.`);
  for (const c of missingCode) gaps.push(`${clusterLabel(c)} — not in your profile.`);
  for (const c of missingOther) gaps.push(`${clusterLabel(c)} — not shown in your profile.`);

  // 2. Relevant experience & projects (20)
  const evidence = new Set<string>();
  for (const c of a.matched) for (const e of evidenceFor(p, c)) evidence.add(e);
  const expScore = evidence.size >= 2 ? 20 : evidence.size === 1 ? 13 : a.matched.size ? 7 : 0;
  components.push({
    key: "experience", label: "Relevant experience & projects", score: expScore, max: 20,
    note: evidence.size ? `Backed by ${[...evidence].slice(0, 4).join(", ")}.` : "No project or role directly shows this work.",
  });
  if (evidence.size) reasons.push(`Relevant work: ${[...evidence].slice(0, 4).join(", ")}.`);

  // 3. Experience level (15)
  let levelScore = 13;
  let fit = "No level stated — likely suitable.";
  const years = lvl.years;
  if (a.yearsRequired != null && years != null && a.yearsRequired > years + 1) {
    levelScore = a.yearsRequired > years + 3 ? 3 : 7;
    fit = `Asks for ${a.yearsRequired}+ years; your listed roles go back about ${Math.floor(years)} years.`;
    gaps.push(`Experience: asks for ${a.yearsRequired}+ years.`);
  } else if (a.seniority === "lead" || a.seniority === "senior") {
    const lead = hasLeadRole(p);
    const leadRole = p.experiences.find((e) => /\blead\b|\bhead\b|\bprincipal\b/i.test(e.title));
    const kind = a.seniority === "lead" ? "Lead-level" : "Senior";
    levelScore = lvl.level === "senior" ? 14 : lead ? 10 : 6;
    fit = lead && leadRole
      ? `${kind} role; you held "${leadRole.title}" at ${leadRole.organization}, so it may be within reach.`
      : `${kind} role — a step up from your listed experience.`;
    if (!lead && lvl.level !== "senior") gaps.push("Seniority: role is above your listed level.");
  } else if (a.seniority === "intern" || a.seniority === "junior") {
    levelScore = lvl.level === "junior" ? 15 : 12;
    fit = lvl.level === "junior" ? "Entry-level role that fits your experience." : "Entry-level role — you may be over-qualified, but it's an easy fit.";
  } else if (a.yearsRequired != null) {
    levelScore = 15;
    fit = `Asks for ${a.yearsRequired}+ years — consistent with your listed experience.`;
  } else if (o.kind !== "employment") {
    fit = "Project work — level judged by your portfolio rather than years.";
  }
  components.push({ key: "level", label: "Experience level", score: levelScore, max: 15, note: fit });

  // 4. Location & work arrangement (10)
  let locScore = 6;
  let locNote = "Location or arrangement not stated.";
  const arr = o.work_arrangement ?? (/\bremote\b/i.test(`${o.location ?? ""} ${o.title}`) ? "remote" : null);
  if (arr && prefs.work_arrangements.includes(arr)) {
    locScore = 10; locNote = `${arr[0].toUpperCase()}${arr.slice(1)} — matches your preference.`;
  } else if (inList(o.location, prefs.locations)) {
    locScore = 10; locNote = `${o.location} is one of your locations.`;
  } else if (arr || o.location) {
    const where = o.location && arr && o.location.toLowerCase().includes(arr) ? o.location : [arr, o.location].filter(Boolean).join(" · ");
    locScore = 3; locNote = `${where} — outside your preferences.`;
    gaps.push(`Location: ${where}.`);
  }
  components.push({ key: "location", label: "Location & arrangement", score: locScore, max: 10, note: locNote });

  // 5. Employment type (10)
  let typeScore = 6;
  let typeNote = "Employment type not stated.";
  const type = o.employment_type ?? (o.kind === "employment" ? null : "freelance");
  if (type === "internship" && !prefs.include_internships) {
    typeScore = 1; typeNote = "Internship — you've turned internships off.";
  } else if (type && (prefs.employment_types.includes(type) || (type === "freelance" && prefs.opportunity_kinds.includes("freelance")))) {
    typeScore = 10; typeNote = `${type.replace("_", "-")} — one of your preferred types.`;
  } else if (type) {
    typeScore = 3; typeNote = `${type.replace("_", "-")} — not one of your preferred types.`;
  }
  components.push({ key: "type", label: "Employment type", score: typeScore, max: 10, note: typeNote });

  // 6. Compensation (10)
  let payScore = 6;
  let payNote = "Pay not disclosed.";
  const top = o.salary_max ?? o.salary_min ?? null;
  if (top != null) {
    if (prefs.min_salary == null) { payScore = 7; payNote = "Pay disclosed; you haven't set a minimum."; }
    else if (o.currency && prefs.currency && o.currency.toUpperCase() !== prefs.currency.toUpperCase()) {
      payScore = 6; payNote = `Pay is in ${o.currency}; your minimum is in ${prefs.currency} — compare manually.`;
    } else if (top >= prefs.min_salary) { payScore = 10; payNote = "Meets your minimum."; reasons.push("Pay meets your minimum."); }
    else { payScore = 2; payNote = "Below your minimum."; gaps.push("Pay is below your minimum."); }
  }
  components.push({ key: "pay", label: "Compensation", score: payScore, max: 10, note: payNote });

  let score = components.reduce((n, c) => n + c.score, 0);

  // Caps: keyword overlap cannot carry a role the candidate can't realistically do.
  if (a.codeHeavyRole) {
    if (score > 49) { score = 49; }
    caps.push("Engineering-focused role — coding is secondary for you, so this is capped at Stretch.");
  }
  if (a.matched.size === 0) {
    if (score > 30) score = 30;
    caps.push("None of your skill areas appear in this posting.");
  } else if (a.titleRelevance < 0.5 && score > 64) {
    score = 64;
    caps.push("Your skills appear in the description, but the role itself isn't one of your disciplines.");
  }

  const band = bandFor(score);
  const deliverable =
    a.codeHeavyRole ? "Probably not without significant coding beyond your current profile."
    : a.matched.size === 0 ? "Unclear — the work doesn't line up with your profile."
    : missingCode.length ? `Likely, if the ${missingCode.map(clusterLabel).join(" / ")} parts are minor.`
    : "Yes — this is work your profile shows you've done.";

  return {
    score, band, mode: opts.mode ?? "keyword", components, reasons, gaps, caps,
    experience_fit: fit, deliverable,
  };
}
