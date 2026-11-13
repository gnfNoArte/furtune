import { getJson, guessEmploymentType, htmlToText, toIso, truncate } from "./http";
import { looksRelevant } from "./filter";
import type { SourceAdapter } from "./types";

interface ArbeitnowJob {
  slug: string; company_name: string; title: string; description: string; remote: boolean; url: string;
  tags: string[]; job_types: string[]; location: string; created_at: number;
}

export const arbeitnow: SourceAdapter = {
  id: "arbeitnow",
  name: "Arbeitnow",
  kinds: ["employment"],
  access: "Public Arbeitnow job-board API (no key)",
  coverage: "Mostly Europe-based vacancies (latest pages, filtered locally).",
  availability: () => ({ state: "ready" }),
  async search({ plan }) {
    const queries = ["page 1", "page 2"];
    try {
      const pages = await Promise.all([1, 2].map((p) => getJson<{ data: ArbeitnowJob[] }>(`https://www.arbeitnow.com/api/job-board-api?page=${p}`)));
      const items = pages.flatMap((p) => p.data ?? []).map((j) => {
        const description = truncate(htmlToText(j.description));
        return {
          source: "arbeitnow", external_id: j.slug, url: j.url, kind: "employment" as const,
          title: j.title, description, company: j.company_name, publisher: j.company_name, location: j.location,
          work_arrangement: j.remote ? ("remote" as const) : ("onsite" as const),
          employment_type: guessEmploymentType((j.job_types ?? []).join(" "), j.title),
          published_at: toIso(j.created_at), tags: j.tags, access_method: "Public API",
        };
      }).filter((j) => looksRelevant(`${j.title} ${(j.tags ?? []).join(" ")} ${j.description}`, plan));
      return { items, status: "ok", queries };
    } catch (e) {
      return { items: [], status: "failed", message: (e as Error).message, queries };
    }
  },
};
