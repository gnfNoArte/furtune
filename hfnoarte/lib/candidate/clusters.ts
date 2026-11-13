import { clustersIn } from "../taxonomy";
import type { CandidateProfile } from "../types";

/** Skill clusters the candidate has shown, from their own profile only. */
export function candidateClusters(p: CandidateProfile): Set<string> {
  const text = [
    ...p.skills.map((s) => `${s.name} ${s.category}`),
    ...p.projects.flatMap((pr) => [...pr.skills, ...pr.roles]),
    ...p.experiences.map((e) => e.title),
  ].join(" | ");
  const found = clustersIn(text);
  // "Web design" is shown by any website-building work.
  if (found.has("webflow") || found.has("framer") || found.has("shopify")) {
    found.add("web_design");
    found.add("no_code");
  }
  if (found.has("shopify")) found.add("ecommerce");
  return found;
}

/** Projects and roles that demonstrate each cluster — used as evidence. */
export function evidenceFor(p: CandidateProfile, cluster: string): string[] {
  const out: string[] = [];
  for (const pr of p.projects) {
    const c = clustersIn([...pr.skills, ...pr.roles].join(" | "));
    if (c.has(cluster) || ((cluster === "web_design" || cluster === "no_code") && (c.has("webflow") || c.has("framer") || c.has("shopify")))) out.push(pr.name);
  }
  for (const e of p.experiences) {
    const c = clustersIn(`${e.title} ${e.description ?? ""}`);
    if (c.has(cluster)) out.push(`${e.organization} (${e.title})`);
  }
  return [...new Set(out)];
}

const monthsBetween = (a: Date, b: Date) =>
  (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

/**
 * Years since the earliest listed role. This is derived only from the dates
 * the candidate entered; it is shown as an estimate the candidate can override.
 */
export function yearsOfExperience(p: CandidateProfile, now = new Date()): number | null {
  const starts = p.experiences.map((e) => e.start).filter(Boolean) as string[];
  if (!starts.length) return null;
  const earliest = starts.map((s) => new Date(`${s.length === 7 ? `${s}-01` : s}T00:00:00Z`)).sort((a, b) => +a - +b)[0];
  if (Number.isNaN(+earliest)) return null;
  return Math.max(0, Math.round((monthsBetween(earliest, now) / 12) * 10) / 10);
}

export type Level = "junior" | "mid" | "senior";
export function candidateLevel(p: CandidateProfile, now = new Date()): { level: Level; source: "candidate" | "estimated"; years: number | null } {
  const years = yearsOfExperience(p, now);
  const set = p.experience_level?.toLowerCase();
  if (set === "junior" || set === "mid" || set === "senior") return { level: set, source: "candidate", years };
  if (years == null) return { level: "mid", source: "estimated", years };
  return { level: years < 2 ? "junior" : years < 6 ? "mid" : "senior", source: "estimated", years };
}

export const hasLeadRole = (p: CandidateProfile) => p.experiences.some((e) => /\blead\b|\bhead\b|\bprincipal\b/i.test(e.title));
