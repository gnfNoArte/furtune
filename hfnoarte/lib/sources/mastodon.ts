import { extractBudget, getJson, guessArrangement, htmlToText, toIso, truncate } from "./http";
import { looksRelevant } from "./filter";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

const TAGS = ["hiring", "getfedihired", "fedihired", "webflow", "framer", "uxjobs", "designjobs", "freelance"];

interface Status {
  id: string; url: string | null; uri: string; created_at: string; content: string; in_reply_to_id: string | null;
  account: { acct: string; display_name: string; url: string; followers_count: number; statuses_count: number; created_at: string; bot?: boolean };
}

export const mastodon: SourceAdapter = {
  id: "mastodon",
  name: "Mastodon",
  kinds: ["social", "freelance", "employment"],
  access: "Public hashtag timelines (no key)",
  coverage: "Hashtag posts as seen by one Mastodon server (set MASTODON_INSTANCE). Posts without these hashtags aren't visible without signing in.",
  availability: () => ({ state: "limited", note: "Hashtag timelines only — full-text search needs an account on the server." }),
  async search({ plan, now }) {
    const host = process.env.MASTODON_INSTANCE || "mastodon.social";
    const statuses = new Map<string, Status>();
    const errors: string[] = [];
    for (const tag of TAGS) {
      try {
        const data = await getJson<Status[]>(`https://${host}/api/v1/timelines/tag/${tag}?limit=40`);
        for (const s of data) statuses.set(s.uri, s);
      } catch (e) { errors.push((e as Error).message); }
    }
    const items: RawOpportunity[] = [...statuses.values()]
      .filter((s) => !s.account.bot && +now - +new Date(s.created_at) < 21 * 86_400_000)
      .map((s) => {
        const text = htmlToText(s.content);
        const budget = extractBudget(text);
        return {
          source: "mastodon", external_id: s.uri, url: s.url ?? s.uri, kind: "social" as const,
          title: text.split("\n")[0].slice(0, 140), description: truncate(text),
          publisher: s.account.display_name ? `${s.account.display_name} (@${s.account.acct})` : `@${s.account.acct}`,
          publisher_url: s.account.url, work_arrangement: guessArrangement(text), employment_type: null,
          salary_text: budget?.text ?? null, salary_min: budget?.min ?? null, salary_max: budget?.max ?? null, currency: budget?.currency ?? null,
          published_at: toIso(s.created_at), access_method: "Public hashtag timeline",
          tags: s.in_reply_to_id ? ["reply"] : [],
          author_meta: { followers: s.account.followers_count, posts: s.account.statuses_count, account_created_at: s.account.created_at },
        };
      })
      .filter((i) => looksRelevant(i.description, plan));
    return {
      items, queries: TAGS.map((t) => `#${t}`),
      status: errors.length === TAGS.length ? "failed" : "limited",
      message: errors.length ? `${errors.length} hashtag(s) failed: ${errors[0]}` : "Hashtag timelines only.",
    };
  },
};
