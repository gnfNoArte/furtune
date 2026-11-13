// Turn resume text into a structured profile. AI is used when available;
// otherwise a keyword pass finds skills and date-ranged roles. In both cases
// anything that can't be traced back to the resume text is dropped.
import "server-only";
import { chatJson } from "../ai/client";
import { HONESTY_RULES } from "../ai/rules";
import { CLUSTERS, clustersIn } from "../taxonomy";
import type { CandidateProfile, Experience, Skill } from "../types";

export interface Extraction {
  profile: CandidateProfile;
  mode: "ai" | "keyword";
  warnings: string[];
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december";
const DATE = `(?:(?:${MONTHS})\\.?\\s+)?(?:19|20)\\d{2}`;
const RANGE = new RegExp(`(${DATE})\\s*(?:-|–|—|to)\\s*(${DATE}|present|current|now)`, "i");

function toYm(s: string): string | undefined {
  const y = /(19|20)\d{2}/.exec(s)?.[0];
  if (!y) return undefined;
  const m = new RegExp(`^(${MONTHS})`, "i").exec(s.trim())?.[1]?.toLowerCase().slice(0, 3);
  const idx = m ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m) + 1 : 0;
  return idx ? `${y}-${String(idx).padStart(2, "0")}` : y;
}

/** Words of a phrase that must appear in the resume for it to count. */
const traceable = (phrase: string, text: string) => {
  const words = phrase.toLowerCase().split(/[^a-z0-9.+#]+/).filter((w) => w.length > 2 && !["and", "the", "for", "with", "design", "development"].includes(w));
  if (!words.length) return text.toLowerCase().includes(phrase.toLowerCase());
  return words.some((w) => text.toLowerCase().includes(w));
};

export function keywordExtract(text: string): Extraction {
  const found = clustersIn(text);
  const skills: Skill[] = CLUSTERS.filter((c) => found.has(c.id)).map((c) => ({ name: c.label, category: c.codeHeavy ? "Technical" : "Skills", evidence: "Found in resume text" }));
  const experiences: Experience[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const m = RANGE.exec(line);
    if (!m) return;
    const label = line.replace(m[0], "").replace(/[|,·•–—-]+\s*$/, "").trim() || lines[i - 1] || "Role";
    const [title, organization] = label.split(/\s+(?:at|@|—|–|-|\|)\s+/);
    experiences.push({
      title: (title || label).slice(0, 120), organization: (organization || "").slice(0, 120),
      kind: /freelance|independent|self-employed/i.test(line) ? "freelance" : "employment",
      start: toYm(m[1]), end: /present|current|now/i.test(m[2]) ? null : toYm(m[2]),
    });
  });
  return {
    mode: "keyword",
    warnings: ["Keyword mode: AI isn't configured, so only skills and date-ranged lines were picked up. Please check and complete your profile."],
    profile: { skills, experiences, projects: [], education: [], suggested_titles: [], headline: lines[1]?.slice(0, 160) ?? null, full_name: lines[0]?.slice(0, 80) ?? null, origin: "resume" },
  };
}

export async function aiExtract(text: string): Promise<Extraction> {
  const system = `You extract a structured candidate profile from a resume.
${HONESTY_RULES}
- Only include information explicitly written in the resume. Do not upgrade titles, add skills from job descriptions you imagine, or estimate results.
- experience kind: "employment" | "freelance" | "contract" | "project". Project kind: "client" | "personal" | "exploration" | "employment".
- Dates as "YYYY-MM" or "YYYY"; end null if current.
- experience_level: "junior" | "mid" | "senior" only if the resume makes it clear, else null.
Return JSON: {full_name, headline, summary, experience_level, skills:[{name, category, evidence}], experiences:[{title, organization, kind, start, end, description}], projects:[{name, kind, roles[], skills[], description, url}], education:[{institution, qualification, start, end}], suggested_titles:[string]}
suggested_titles: realistic job titles this exact background qualifies for, across all its disciplines.`;
  const out = await chatJson<CandidateProfile>(system, `RESUME:\n${text.slice(0, 14_000)}`, { maxTokens: 3000, temperature: 0 });
  const warnings: string[] = [];
  const skills = (out.skills ?? []).filter((s) => {
    const ok = s?.name && traceable(s.name, text);
    if (!ok && s?.name) warnings.push(`Removed "${s.name}" — not found in the resume text.`);
    return ok;
  });
  const experiences = (out.experiences ?? []).filter((e) => e?.title && (traceable(e.organization || e.title, text)));
  const projects = (out.projects ?? []).filter((p) => p?.name && traceable(p.name, text));
  return {
    mode: "ai",
    warnings,
    profile: {
      full_name: out.full_name ?? null, headline: out.headline ?? null, summary: out.summary ?? null,
      experience_level: ["junior", "mid", "senior"].includes(String(out.experience_level)) ? out.experience_level : null,
      skills, experiences, projects,
      education: (out.education ?? []).filter((e) => e?.institution && traceable(e.institution, text)),
      suggested_titles: (out.suggested_titles ?? []).slice(0, 15),
      origin: "resume",
    },
  };
}
