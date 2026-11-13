import { SourceError, USER_AGENT, extractBudget, getJson, guessArrangement, toIso, truncate } from "./http";
import { looksRelevant } from "./filter";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

const SUBREDDITS = ["forhire", "hiring", "HireaWriter", "DesignJobs", "webflow", "framer", "shopify", "web_design", "UI_Design", "web3jobs", "freelance_forhire", "slavelabour"];

interface Post {
  id: string; title: string; selftext: string; author: string; created_utc: number; permalink: string;
  link_flair_text?: string | null; subreddit: string; over_18?: boolean;
}

async function token(): Promise<string> {
  const id = process.env.REDDIT_CLIENT_ID!;
  const secret = process.env.REDDIT_CLIENT_SECRET!;
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT || USER_AGENT,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new SourceError(`Reddit sign-in failed (${res.status}) — check REDDIT_CLIENT_ID / SECRET`, res.status);
  return ((await res.json()) as { access_token: string }).access_token;
}

export const reddit: SourceAdapter = {
  id: "reddit",
  name: "Reddit",
  kinds: ["freelance", "social", "employment"],
  access: "Official Reddit API, app-only sign-in (free for personal use)",
  coverage: "New posts in hiring and design subreddits, plus a site-wide search for hiring phrases. Comments are not searched — Reddit's API doesn't offer comment search.",
  availability() {
    return process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET
      ? { state: "limited", note: "Posts only — comment search isn't available in Reddit's API." }
      : { state: "not_configured", note: "Needs a free Reddit app.", setup: "Create a 'script' app at reddit.com/prefs/apps and set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET." };
  },
  async search({ plan, now }) {
    const queries: string[] = [];
    try {
      const t = await token();
      const headers = { Authorization: `Bearer ${t}`, "User-Agent": process.env.REDDIT_USER_AGENT || USER_AGENT };
      const posts = new Map<string, Post>();
      const listing = async (url: string, label: string) => {
        queries.push(label);
        const data = await getJson<{ data: { children: { data: Post }[] } }>(url, { headers });
        for (const c of data.data.children) posts.set(c.data.id, c.data);
      };
      await listing(`https://oauth.reddit.com/r/${SUBREDDITS.join("+")}/new?limit=100&raw_json=1`, `new posts in r/${SUBREDDITS.slice(0, 4).join(", r/")}…`);
      for (const phrase of plan.phrases.slice(0, 4)) {
        await listing(`https://oauth.reddit.com/search?q=${encodeURIComponent(`"${phrase}"`)}&sort=new&t=week&limit=25&raw_json=1`, `"${phrase}"`);
      }

      const maxAge = 21 * 86_400_000;
      const kept = [...posts.values()].filter((p) => !p.over_18 && +now - p.created_utc * 1000 < maxAge && looksRelevant(`${p.title} ${p.selftext}`, plan));

      // Public account facts for credibility (only for the posts we keep).
      const authors = [...new Set(kept.map((p) => p.author))].filter((a) => a !== "[deleted]").slice(0, 25);
      const meta = new Map<string, { created: number; karma: number }>();
      await Promise.all(authors.map(async (a) => {
        try {
          const u = await getJson<{ data: { created_utc: number; total_karma?: number; link_karma?: number; comment_karma?: number } }>(`https://oauth.reddit.com/user/${a}/about?raw_json=1`, { headers });
          meta.set(a, { created: u.data.created_utc, karma: u.data.total_karma ?? (u.data.link_karma ?? 0) + (u.data.comment_karma ?? 0) });
        } catch { /* profile hidden or suspended — leave unknown */ }
      }));

      const items: RawOpportunity[] = kept.map((p) => {
        const tag = `${p.link_flair_text ?? ""} ${p.title}`;
        const hint = /\bfor\s*hire\b/i.test(tag) ? "for_hire" : /\bhiring\b|\btask\b|\bpaid\b/i.test(tag) ? "hiring" : null;
        const text = `${p.title}\n\n${p.selftext}`;
        const budget = extractBudget(text);
        const m = meta.get(p.author);
        return {
          source: "reddit", external_id: p.id, url: `https://www.reddit.com${p.permalink}`, kind: "social",
          title: p.title.replace(/^\s*\[[^\]]+\]\s*/, ""), description: truncate(p.selftext || p.title),
          publisher: `u/${p.author}`, publisher_url: `https://www.reddit.com/user/${p.author}`,
          location: guessArrangement(text) === "remote" ? "Remote" : null, work_arrangement: guessArrangement(text),
          employment_type: "freelance",
          salary_text: budget?.text ?? null, salary_min: budget?.min ?? null, salary_max: budget?.max ?? null, currency: budget?.currency ?? null,
          published_at: toIso(p.created_utc), tags: [`r/${p.subreddit}`], access_method: "Official API",
          author_meta: m ? { account_created_at: toIso(m.created), karma: m.karma } : undefined,
          source_hint: hint,
        };
      });
      return { items, status: "limited", message: "Posts searched; comments aren't searchable through Reddit's API.", queries };
    } catch (e) {
      return { items: [], status: "failed", message: (e as Error).message, queries };
    }
  },
};
