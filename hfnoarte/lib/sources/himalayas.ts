import { getJson, guessEmploymentType, htmlToText, toIso, truncate } from "./http";
import { uniq } from "./filter";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

interface HimalayasJob {
  title: string; excerpt?: string; description?: string; companyName?: string; employmentType?: string;
  minSalary?: number | null; maxSalary?: number | null; currency?: string | null;
  locationRestrictions?: string[]; pubDate?: number | string; applicationLink?: string; guid?: string; seniority?: string[];
}

export const himalayas: SourceAdapter = {
  id: "himalayas",
  name: "Himalayas",
  kinds: ["employment"],
  access: "Public Himalayas jobs API (no key)",
  coverage: "Remote vacancies matching each search term.",
  availability: () => ({ state: "ready" }),
  async search({ plan }) {
    const terms = uniq([...plan.keywords.slice(0, 3), ...plan.titles.slice(0, 2)]).slice(0, 4);
    const items: RawOpportunity[] = [];
    const errors: string[] = [];
    for (const term of terms) {
      try {
        const data = await getJson<{ jobs?: HimalayasJob[] }>(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(term)}&limit=20`);
        for (const j of data.jobs ?? []) {
          items.push({
            source: "himalayas", external_id: j.guid, url: j.applicationLink ?? j.guid ?? null, kind: "employment",
            title: j.title, description: truncate(htmlToText(j.description || j.excerpt)),
            company: j.companyName ?? null, publisher: j.companyName ?? null,
            location: j.locationRestrictions?.length ? `Remote (${j.locationRestrictions.join(", ")})` : "Remote",
            work_arrangement: "remote", employment_type: guessEmploymentType(j.employmentType),
            salary_min: j.minSalary ?? null, salary_max: j.maxSalary ?? null, currency: j.currency ?? null,
            salary_text: j.minSalary ? `${j.minSalary}–${j.maxSalary ?? j.minSalary} ${j.currency ?? ""}`.trim() : null,
            published_at: toIso(j.pubDate), access_method: "Public API",
          });
        }
      } catch (e) { errors.push((e as Error).message); }
    }
    const status = errors.length === terms.length ? "failed" : errors.length ? "limited" : "ok";
    return { items, status, message: errors[0], queries: terms };
  },
};
