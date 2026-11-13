import { extractBudget, getJson, guessArrangement, guessEmploymentType, htmlToText, toIso, truncate } from "./http";
import { looksRelevant } from "./filter";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

interface Hit { objectID: string; title?: string; comment_text?: string; author: string; created_at: string; story_id?: number }

async function latestThread(query: string): Promise<Hit | null> {
  const data = await getJson<{ hits: Hit[] }>(
    `https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=${encodeURIComponent(query)}&hitsPerPage=5`,
  );
  return data.hits.find((h) => h.title?.toLowerCase().includes(query.toLowerCase().split(" ")[0])) ?? data.hits[0] ?? null;
}

export const hackernews: SourceAdapter = {
  id: "hackernews",
  name: "Hacker News hiring threads",
  kinds: ["employment", "freelance", "social"],
  access: "Official HN search API by Algolia (no key)",
  coverage: "Comments in this month's \"Who is hiring?\" and \"Seeking freelancer?\" threads. Each comment is a public hiring post.",
  availability: () => ({ state: "ready" }),
  async search({ plan }) {
    const items: RawOpportunity[] = [];
    const queries: string[] = [];
    const threads: { q: string; kind: "employment" | "freelance" }[] = [
      { q: "Who is hiring", kind: "employment" },
      { q: "Freelancer Seeking freelancer", kind: "freelance" },
    ];
    const terms = ["designer", "webflow", "framer", "ux", "brand", "website"];
    let failures = 0;
    for (const t of threads) {
      try {
        const thread = await latestThread(t.q);
        if (!thread) continue;
        queries.push(`${thread.title}`);
        const seen = new Set<string>();
        for (const term of terms) {
          const data = await getJson<{ hits: Hit[] }>(
            `https://hn.algolia.com/api/v1/search?tags=comment,story_${thread.objectID}&query=${encodeURIComponent(term)}&hitsPerPage=40`,
          );
          for (const h of data.hits) {
            if (seen.has(h.objectID)) continue;
            seen.add(h.objectID);
            const text = htmlToText(h.comment_text);
            // Freelancer thread mixes "SEEKING WORK" (freelancers) with "SEEKING FREELANCER" (clients).
            if (t.kind === "freelance" && !/seeking freelancer/i.test(text)) continue;
            if (!looksRelevant(text, plan)) continue;
            const firstLine = text.split("\n")[0].slice(0, 160);
            const parts = firstLine.split("|").map((s) => s.trim());
            const budget = extractBudget(text);
            items.push({
              source: "hackernews", external_id: h.objectID, url: `https://news.ycombinator.com/item?id=${h.objectID}`,
              kind: t.kind, title: t.kind === "employment" && parts.length > 1 ? parts.slice(0, 2).join(" — ") : firstLine,
              description: truncate(text), company: t.kind === "employment" && parts.length > 1 ? parts[0] : null,
              publisher: h.author, publisher_url: `https://news.ycombinator.com/user?id=${h.author}`,
              location: parts.find((p) => /remote|onsite|hybrid|[A-Z][a-z]+,? [A-Z]{2}\b/.test(p)) ?? null,
              work_arrangement: guessArrangement(firstLine), employment_type: t.kind === "freelance" ? "freelance" : guessEmploymentType(firstLine),
              salary_text: budget?.text ?? null, salary_min: budget?.min ?? null, salary_max: budget?.max ?? null, currency: budget?.currency ?? null,
              published_at: toIso(h.created_at), access_method: "Official search API",
              source_hint: "hiring",
            });
          }
        }
      } catch {
        failures++;
      }
    }
    return { items, status: failures === threads.length ? "failed" : failures ? "limited" : "ok", queries, message: failures ? "Some HN threads could not be read." : undefined };
  },
};
