import { getJson, guessEmploymentType, htmlToText, toIso, truncate } from "./http";
import { uniq } from "./filter";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

interface JobicyJob {
  id: number; url: string; jobTitle: string; companyName: string; jobType?: string[]; jobGeo?: string;
  jobLevel?: string; jobExcerpt?: string; jobDescription?: string; pubDate?: string;
  annualSalaryMin?: number; annualSalaryMax?: number; salaryCurrency?: string;
}

export const jobicy: SourceAdapter = {
  id: "jobicy",
  name: "Jobicy",
  kinds: ["employment"],
  access: "Public Jobicy API (no key)",
  coverage: "Remote vacancies by tag. Jobicy asks for attribution and a link back.",
  availability: () => ({ state: "ready" }),
  async search({ plan }) {
    const tags = uniq(["webflow", "figma", "ui ux", ...plan.keywords.slice(0, 3)]).slice(0, 5);
    const items: RawOpportunity[] = [];
    const errors: string[] = [];
    for (const tag of tags) {
      try {
        const data = await getJson<{ jobs?: JobicyJob[] }>(`https://jobicy.com/api/v2/remote-jobs?count=30&tag=${encodeURIComponent(tag)}`);
        for (const j of data.jobs ?? []) {
          items.push({
            source: "jobicy", external_id: String(j.id), url: j.url, kind: "employment",
            title: htmlToText(j.jobTitle), description: truncate(htmlToText(j.jobDescription || j.jobExcerpt)),
            company: j.companyName, publisher: j.companyName, location: j.jobGeo ?? "Remote", work_arrangement: "remote",
            employment_type: guessEmploymentType((j.jobType ?? []).join(" ")),
            salary_min: j.annualSalaryMin ?? null, salary_max: j.annualSalaryMax ?? null, currency: j.salaryCurrency ?? null,
            salary_text: j.annualSalaryMin ? `${j.annualSalaryMin}–${j.annualSalaryMax ?? j.annualSalaryMin} ${j.salaryCurrency ?? ""} / year`.trim() : null,
            published_at: toIso(j.pubDate), access_method: "Public API",
          });
        }
      } catch (e) { errors.push((e as Error).message); }
    }
    const status = errors.length === tags.length ? "failed" : errors.length ? "limited" : "ok";
    return { items, status, message: errors[0], queries: tags };
  },
};
