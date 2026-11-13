import { getJson, guessEmploymentType, htmlToText, toIso, truncate } from "./http";
import { looksRelevant } from "./filter";
import type { SourceAdapter } from "./types";

interface RemoteOkJob {
  id?: string; epoch?: number; date?: string; company?: string; position?: string; tags?: string[];
  description?: string; location?: string; salary_min?: number; salary_max?: number; url?: string; legal?: string;
}

export const remoteok: SourceAdapter = {
  id: "remoteok",
  name: "Remote OK",
  kinds: ["employment"],
  access: "Public Remote OK JSON feed (no key)",
  coverage: "Latest remote vacancies (one feed, filtered locally). Remote OK requires a link back, which hfNoArte keeps.",
  availability: () => ({ state: "ready" }),
  async search({ plan }) {
    try {
      const data = await getJson<RemoteOkJob[]>("https://remoteok.com/api");
      const items = data
        .filter((j) => j.position && !j.legal)
        .map((j) => {
          const description = truncate(htmlToText(j.description));
          return {
            source: "remoteok", external_id: j.id, url: j.url ?? null, kind: "employment" as const,
            title: j.position!, description, company: j.company ?? null, publisher: j.company ?? null,
            location: j.location || "Remote", work_arrangement: "remote" as const,
            employment_type: guessEmploymentType((j.tags ?? []).join(" "), j.position),
            salary_min: j.salary_min || null, salary_max: j.salary_max || null, currency: j.salary_min ? "USD" : null,
            salary_text: j.salary_min ? `$${j.salary_min.toLocaleString()}–$${(j.salary_max ?? j.salary_min).toLocaleString()}` : null,
            published_at: toIso(j.epoch ?? j.date), tags: j.tags, access_method: "Public JSON feed",
          };
        })
        .filter((j) => looksRelevant(`${j.title} ${(j.tags ?? []).join(" ")} ${j.description}`, plan));
      return { items, status: "ok", queries: ["latest feed"] };
    } catch (e) {
      return { items: [], status: "failed", message: (e as Error).message, queries: ["latest feed"] };
    }
  },
};
