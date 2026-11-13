import { getJson, guessEmploymentType, htmlToText, toIso, truncate } from "./http";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";
import { uniq } from "./filter";

interface RemotiveJob {
  id: number; url: string; title: string; company_name: string; category: string; tags: string[];
  job_type: string; publication_date: string; candidate_required_location: string; salary: string; description: string;
}

export const remotive: SourceAdapter = {
  id: "remotive",
  name: "Remotive",
  kinds: ["employment"],
  access: "Public Remotive API (no key)",
  coverage: "Remote vacancies only. Remotive asks API users to link back to the original listing, which hfNoArte always does.",
  availability: () => ({ state: "ready" }),
  async search({ plan }) {
    const terms = uniq([...plan.keywords.slice(0, 4), ...plan.titles.slice(0, 2)]);
    const queries = terms;
    const items: RawOpportunity[] = [];
    const errors: string[] = [];
    for (const term of terms) {
      try {
        const data = await getJson<{ jobs: RemotiveJob[] }>(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(term)}&limit=40`);
        for (const j of data.jobs ?? []) {
          items.push({
            source: "remotive", external_id: String(j.id), url: j.url, kind: "employment",
            title: j.title, description: truncate(htmlToText(j.description)), company: j.company_name, publisher: j.company_name,
            location: j.candidate_required_location || "Remote", work_arrangement: "remote",
            employment_type: guessEmploymentType(j.job_type), salary_text: j.salary || null,
            published_at: toIso(j.publication_date), tags: j.tags, access_method: "Public API",
          });
        }
      } catch (e) { errors.push((e as Error).message); }
    }
    if (errors.length === terms.length) return { items, status: "failed", message: errors[0], queries };
    return { items, status: errors.length ? "limited" : "ok", message: errors[0], queries };
  },
};
