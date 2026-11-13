import { extractBudget, getJson, guessArrangement, toIso, truncate } from "./http";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

interface ThreadsPost { id: string; text?: string; permalink?: string; timestamp?: string; username?: string }

export const threads: SourceAdapter = {
  id: "threads",
  name: "Threads",
  kinds: ["social", "freelance"],
  access: "Official Threads API keyword search (free; needs a Meta app)",
  coverage: "Recent public posts for each phrase. Until Meta approves the threads_keyword_search permission for your app, results only include your own posts.",
  availability() {
    return process.env.THREADS_ACCESS_TOKEN
      ? { state: "limited", note: "Full public search needs Meta's approval of threads_keyword_search for your app." }
      : { state: "not_configured", note: "Needs a free Meta developer app.", setup: "Create a Threads app at developers.facebook.com, request threads_basic + threads_keyword_search, and set THREADS_ACCESS_TOKEN." };
  },
  async search({ plan }) {
    const queries = plan.phrases.slice(0, 6);
    const items: RawOpportunity[] = [];
    const errors: string[] = [];
    for (const q of queries) {
      try {
        const data = await getJson<{ data: ThreadsPost[] }>(
          `https://graph.threads.net/v1.0/keyword_search?q=${encodeURIComponent(q)}&search_type=RECENT&fields=id,text,permalink,timestamp,username&access_token=${encodeURIComponent(process.env.THREADS_ACCESS_TOKEN!)}`,
        );
        for (const p of data.data ?? []) {
          const text = p.text ?? "";
          const budget = extractBudget(text);
          items.push({
            source: "threads", external_id: p.id, url: p.permalink ?? null, kind: "social",
            title: text.split("\n")[0].slice(0, 140), description: truncate(text),
            publisher: p.username ? `@${p.username}` : null, publisher_url: p.username ? `https://www.threads.net/@${p.username}` : null,
            work_arrangement: guessArrangement(text), employment_type: "freelance",
            salary_text: budget?.text ?? null, salary_min: budget?.min ?? null, salary_max: budget?.max ?? null, currency: budget?.currency ?? null,
            published_at: toIso(p.timestamp), access_method: "Official API",
          });
        }
      } catch (e) { errors.push((e as Error).message); }
    }
    return {
      items, queries,
      status: errors.length === queries.length ? "failed" : "limited",
      message: errors[0] ?? "Results depend on Meta's approval of keyword search for your app.",
    };
  },
};
