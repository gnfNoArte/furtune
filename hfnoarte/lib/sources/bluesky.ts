import { SourceError, extractBudget, getJson, guessArrangement, toIso, truncate } from "./http";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

interface BskyPost {
  uri: string; author: { did: string; handle: string; displayName?: string };
  record: { text?: string; createdAt?: string; reply?: unknown }; indexedAt: string;
}
interface BskyProfile { did: string; followersCount?: number; postsCount?: number; createdAt?: string }

const PDS = "https://bsky.social/xrpc";

async function session(): Promise<string> {
  const res = await fetch(`${PDS}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: process.env.BLUESKY_HANDLE, password: process.env.BLUESKY_APP_PASSWORD }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new SourceError(`Bluesky sign-in failed (${res.status}) — check BLUESKY_HANDLE / BLUESKY_APP_PASSWORD`, res.status);
  return ((await res.json()) as { accessJwt: string }).accessJwt;
}

export const bluesky: SourceAdapter = {
  id: "bluesky",
  name: "Bluesky",
  kinds: ["social", "freelance"],
  access: "Official AT Protocol search API (free account + app password)",
  coverage: "Public posts and replies containing each search phrase.",
  availability() {
    return process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD
      ? { state: "ready" }
      : { state: "not_configured", note: "Needs a free Bluesky account.", setup: "Create an app password in Bluesky → Settings → App passwords, then set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD." };
  },
  async search({ plan }) {
    const queries = plan.phrases.slice(0, 8);
    try {
      const jwt = await session();
      const headers = { Authorization: `Bearer ${jwt}` };
      const posts = new Map<string, BskyPost>();
      for (const q of queries) {
        const data = await getJson<{ posts: BskyPost[] }>(`${PDS}/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&sort=latest&limit=25`, { headers });
        for (const p of data.posts ?? []) posts.set(p.uri, p);
      }
      const dids = [...new Set([...posts.values()].map((p) => p.author.did))];
      const profiles = new Map<string, BskyProfile>();
      for (let i = 0; i < dids.length; i += 25) {
        const qs = dids.slice(i, i + 25).map((d) => `actors=${encodeURIComponent(d)}`).join("&");
        try {
          const data = await getJson<{ profiles: BskyProfile[] }>(`${PDS}/app.bsky.actor.getProfiles?${qs}`, { headers });
          for (const p of data.profiles) profiles.set(p.did, p);
        } catch { /* profile facts are optional */ }
      }
      const items: RawOpportunity[] = [...posts.values()].map((p) => {
        const text = p.record.text ?? "";
        const rkey = p.uri.split("/").pop();
        const prof = profiles.get(p.author.did);
        const budget = extractBudget(text);
        return {
          source: "bluesky", external_id: p.uri, url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
          kind: "social", title: text.split("\n")[0].slice(0, 140), description: truncate(text),
          publisher: p.author.displayName ? `${p.author.displayName} (@${p.author.handle})` : `@${p.author.handle}`,
          publisher_url: `https://bsky.app/profile/${p.author.handle}`,
          work_arrangement: guessArrangement(text), employment_type: "freelance",
          salary_text: budget?.text ?? null, salary_min: budget?.min ?? null, salary_max: budget?.max ?? null, currency: budget?.currency ?? null,
          published_at: toIso(p.record.createdAt ?? p.indexedAt), access_method: "Official API",
          tags: p.record.reply ? ["reply"] : [],
          author_meta: prof ? { followers: prof.followersCount ?? null, posts: prof.postsCount ?? null, account_created_at: prof.createdAt ?? null } : undefined,
        };
      });
      return { items, status: "ok", queries };
    } catch (e) {
      return { items: [], status: "failed", message: (e as Error).message, queries };
    }
  },
};
