import { getJson, guessArrangement, guessEmploymentType, htmlToText, toIso, truncate } from "./http";
import { looksRelevant } from "./filter";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

// Many companies publish their careers page through Greenhouse, Lever or
// Ashby, which all offer free, public, read-only job-board APIs.

async function greenhouse(token: string): Promise<RawOpportunity[]> {
  const d = await getJson<{ jobs: { id: number; title: string; absolute_url: string; updated_at: string; location?: { name?: string }; content?: string }[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`);
  return d.jobs.map((j) => {
    const description = truncate(htmlToText(htmlToText(j.content)));
    return {
      source: "company_boards", external_id: `gh:${j.id}`, url: j.absolute_url, kind: "employment", title: j.title,
      description, company: token, publisher: token, location: j.location?.name ?? null,
      work_arrangement: guessArrangement(j.location?.name, j.title), employment_type: guessEmploymentType(j.title, description.slice(0, 400)),
      published_at: toIso(j.updated_at), access_method: "Greenhouse public job-board API",
    };
  });
}

async function lever(company: string): Promise<RawOpportunity[]> {
  const d = await getJson<{ id: string; text: string; hostedUrl: string; createdAt: number; descriptionPlain?: string; categories?: { location?: string; commitment?: string }; workplaceType?: string }[]>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`);
  return d.map((j) => ({
    source: "company_boards", external_id: `lever:${j.id}`, url: j.hostedUrl, kind: "employment" as const, title: j.text,
    description: truncate(j.descriptionPlain ?? ""), company, publisher: company, location: j.categories?.location ?? null,
    work_arrangement: guessArrangement(j.workplaceType, j.categories?.location), employment_type: guessEmploymentType(j.categories?.commitment, j.text),
    published_at: toIso(j.createdAt), access_method: "Lever public postings API",
  }));
}

async function ashby(board: string): Promise<RawOpportunity[]> {
  const d = await getJson<{ jobs: { id: string; title: string; jobUrl: string; publishedAt?: string; location?: string; isRemote?: boolean; employmentType?: string; descriptionPlain?: string }[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`);
  return d.jobs.map((j) => ({
    source: "company_boards", external_id: `ashby:${j.id}`, url: j.jobUrl, kind: "employment" as const, title: j.title,
    description: truncate(j.descriptionPlain ?? ""), company: board, publisher: board, location: j.location ?? null,
    work_arrangement: j.isRemote ? ("remote" as const) : guessArrangement(j.location), employment_type: guessEmploymentType(j.employmentType),
    published_at: toIso(j.publishedAt), access_method: "Ashby public job-board API",
  }));
}

export const companyBoards: SourceAdapter = {
  id: "company_boards",
  name: "Company career pages",
  kinds: ["employment"],
  access: "Public Greenhouse, Lever and Ashby job-board APIs (no key)",
  coverage: "Only the companies you list in Preferences (e.g. greenhouse:figma, lever:acme, ashby:linear). Other career pages can be added by pasting a link.",
  availability: () => ({ state: "ready" }),
  async search({ prefs, plan }) {
    const boards = prefs.company_boards ?? [];
    if (!boards.length) return { items: [], status: "skipped", message: "No company boards listed in Preferences yet.", queries: [] };
    const items: RawOpportunity[] = [];
    const errors: string[] = [];
    for (const b of boards) {
      const [provider, name] = b.includes(":") ? b.split(":", 2) : ["greenhouse", b];
      try {
        const got = provider === "lever" ? await lever(name) : provider === "ashby" ? await ashby(name) : await greenhouse(name);
        items.push(...got.filter((j) => looksRelevant(`${j.title} ${j.description}`, plan)));
      } catch (e) { errors.push(`${b}: ${(e as Error).message}`); }
    }
    return { items, status: errors.length === boards.length ? "failed" : errors.length ? "limited" : "ok", message: errors[0], queries: boards };
  },
};
