import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOARTE_SEED_PROFILE as P } from "../lib/candidate/seed";
import { DEFAULT_PREFERENCES } from "../lib/data";
import { buildPlan } from "../lib/discovery/plan";
import { SOURCES } from "../lib/sources";
import { adzuna } from "../lib/sources/adzuna";
import { hackernews } from "../lib/sources/hackernews";
import { remoteok } from "../lib/sources/remoteok";
import { reddit } from "../lib/sources/reddit";
import { bluesky } from "../lib/sources/bluesky";
import { weworkremotely } from "../lib/sources/weworkremotely";
import { mastodon } from "../lib/sources/mastodon";

vi.mock("node:dns/promises", () => ({ lookup: async () => [{ address: "93.184.216.34", family: 4 }] }));

const prefs = { ...DEFAULT_PREFERENCES };
const ctx = { plan: buildPlan(P, prefs), prefs, now: new Date("2026-11-13T00:00:00Z") };
type Route = [RegExp, unknown, number?];
let routes: Route[] = [];
const calls: string[] = [];

beforeEach(() => {
  routes = []; calls.length = 0;
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    const r = routes.find(([re]) => re.test(url));
    if (!r) return new Response("not found", { status: 404 });
    const [, body, status = 200] = r;
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, { status, headers: { "content-type": typeof body === "string" && body.startsWith("<") ? "text/html" : "application/json" } });
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("source registry", () => {
  it("lists every source with an honest availability state", () => {
    const states = Object.fromEntries(SOURCES.map((s) => [s.id, s.availability().state]));
    expect(states.x).toBe("not_integrated");
    expect(states.linkedin).toBe("not_integrated");
    expect(states.instagram).toBe("not_integrated");
    expect(states.remoteok).toBe("ready");
    expect(states.mastodon).toBe("limited");
    expect(["not_configured", "ready", "limited"]).toContain(states.adzuna);
  });
});

describe("adapters", () => {
  it("Remote OK: skips the legal notice and irrelevant jobs", async () => {
    routes.push([/remoteok\.com\/api/, [
      { legal: "API terms" },
      { id: "1", epoch: 1794000000, company: "Acme", position: "Webflow Designer", tags: ["webflow", "design"], description: "<p>Build our site in Webflow</p>", location: "Worldwide", url: "https://remoteok.com/remote-jobs/1", salary_min: 50000, salary_max: 70000 },
      { id: "2", epoch: 1794000000, company: "Gopher", position: "Go Engineer", tags: ["golang"], description: "Kubernetes", url: "https://remoteok.com/remote-jobs/2" },
    ]]);
    const r = await remoteok.search!(ctx);
    expect(r.status).toBe("ok");
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ title: "Webflow Designer", company: "Acme", url: "https://remoteok.com/remote-jobs/1", work_arrangement: "remote", salary_min: 50000 });
  });

  it("Remote OK: reports failure instead of pretending", async () => {
    routes.push([/remoteok\.com\/api/, "busy", 503]);
    const r = await remoteok.search!(ctx);
    expect(r.status).toBe("failed");
    expect(r.message).toMatch(/503/);
  });

  it("Adzuna: ignores predicted salaries and records each query", async () => {
    vi.stubEnv("ADZUNA_APP_ID", "id"); vi.stubEnv("ADZUNA_APP_KEY", "key");
    routes.push([/api\.adzuna\.com/, { results: [{ id: "9", title: "<strong>Web</strong> Designer", description: "Webflow and Figma", created: "2026-11-10T10:00:00Z", redirect_url: "https://adzuna.co.uk/9", company: { display_name: "Studio" }, location: { display_name: "London" }, salary_min: 30000, salary_max: 30000, salary_is_predicted: "1", contract_time: "full_time" }] }]);
    const r = await adzuna.search!(ctx);
    expect(r.status).toBe("ok");
    expect(r.queries.length).toBeGreaterThan(1);
    expect(r.items[0]).toMatchObject({ title: "Web Designer", salary_min: null, employment_type: "full_time", currency: "GBP" });
  });

  it("Hacker News: keeps 'Seeking freelancer' comments and drops 'Seeking work'", async () => {
    routes.push([/search_by_date.*Who%20is%20hiring/, { hits: [{ objectID: "100", title: "Ask HN: Who is hiring? (November 2026)", author: "whoishiring", created_at: "2026-11-01T00:00:00Z" }] }]);
    routes.push([/search_by_date.*Freelancer/, { hits: [{ objectID: "200", title: "Ask HN: Freelancer? Seeking freelancer? (November 2026)", author: "whoishiring", created_at: "2026-11-01T00:00:00Z" }] }]);
    routes.push([/story_100/, { hits: [{ objectID: "101", author: "acme", created_at: "2026-11-02T00:00:00Z", comment_text: "Acme | Product Designer | Remote | Full-time<p>We need a product designer who knows Figma." }] }]);
    routes.push([/story_200/, { hits: [
      { objectID: "201", author: "founder", created_at: "2026-11-02T00:00:00Z", comment_text: "SEEKING FREELANCER | Remote<p>Need a Webflow designer for our landing page, budget $3k." },
      { objectID: "202", author: "dev", created_at: "2026-11-02T00:00:00Z", comment_text: "SEEKING WORK | Webflow designer, see my portfolio" },
    ] }]);
    const r = await hackernews.search!(ctx);
    const ids = r.items.map((i) => i.external_id);
    expect(ids).toContain("101");
    expect(ids).toContain("201");
    expect(ids).not.toContain("202");
    const f = r.items.find((i) => i.external_id === "201")!;
    expect(f).toMatchObject({ kind: "freelance", url: "https://news.ycombinator.com/item?id=201", salary_min: 3000 });
  });

  it("Reddit: marks [For Hire] posts and records account facts", async () => {
    vi.stubEnv("REDDIT_CLIENT_ID", "id"); vi.stubEnv("REDDIT_CLIENT_SECRET", "s");
    routes.push([/access_token/, { access_token: "t" }]);
    const now = 1794528000;
    routes.push([/oauth\.reddit\.com\/r\//, { data: { children: [
      { data: { id: "a", title: "[Hiring] Need a Framer designer for SaaS landing page", selftext: "Budget $800, remote.", author: "founder1", created_utc: now - 3600, permalink: "/r/forhire/comments/a/x/", subreddit: "forhire", link_flair_text: "Hiring" } },
      { data: { id: "b", title: "[For Hire] Webflow designer available", selftext: "Portfolio inside", author: "free1", created_utc: now - 3600, permalink: "/r/forhire/comments/b/y/", subreddit: "forhire", link_flair_text: "For Hire" } },
    ] } }]);
    routes.push([/oauth\.reddit\.com\/search/, { data: { children: [] } }]);
    routes.push([/user\/founder1\/about/, { data: { created_utc: now - 5 * 365 * 86400, total_karma: 2400 } }]);
    const r = await reddit.search!(ctx);
    expect(r.status).toBe("limited");
    const a = r.items.find((i) => i.external_id === "a")!;
    expect(a).toMatchObject({ source_hint: "hiring", url: "https://www.reddit.com/r/forhire/comments/a/x/", salary_min: 800, publisher: "u/founder1" });
    expect(a.author_meta?.karma).toBe(2400);
    expect(r.items.find((i) => i.external_id === "b")!.source_hint).toBe("for_hire");
  });

  it("Bluesky: builds post links and reads public profile facts", async () => {
    vi.stubEnv("BLUESKY_HANDLE", "me.bsky.social"); vi.stubEnv("BLUESKY_APP_PASSWORD", "x");
    routes.push([/createSession/, { accessJwt: "jwt" }]);
    routes.push([/searchPosts/, { posts: [{ uri: "at://did:plc:abc/app.bsky.feed.post/3kxyz", author: { did: "did:plc:abc", handle: "maker.bsky.social", displayName: "Maker" }, record: { text: "Looking for a webflow developer to rebuild our site", createdAt: "2026-11-12T10:00:00Z" }, indexedAt: "2026-11-12T10:00:01Z" }] }]);
    routes.push([/getProfiles/, { profiles: [{ did: "did:plc:abc", followersCount: 40, postsCount: 300, createdAt: "2024-01-01T00:00:00Z" }] }]);
    const r = await bluesky.search!(ctx);
    expect(r.items[0]).toMatchObject({ url: "https://bsky.app/profile/maker.bsky.social/post/3kxyz", publisher: "Maker (@maker.bsky.social)" });
    expect(r.items[0].author_meta?.followers).toBe(40);
  });

  it("We Work Remotely: parses the RSS feed", async () => {
    routes.push([/weworkremotely/, `<?xml version="1.0"?><rss><channel><item><title>Acme: Senior Product Designer</title><region>Anywhere in the World</region><link>https://weworkremotely.com/remote-jobs/acme-senior-product-designer</link><pubDate>Tue, 10 Nov 2026 10:00:00 +0000</pubDate><description>&lt;p&gt;Figma, design systems&lt;/p&gt;</description><type>Full-Time</type></item></channel></rss>`]);
    const r = await weworkremotely.search!(ctx);
    expect(r.items[0]).toMatchObject({ company: "Acme", title: "Senior Product Designer", employment_type: "full_time" });
  });

  it("Mastodon: skips bots", async () => {
    routes.push([/timelines\/tag/, [
      { id: "1", uri: "u1", url: "https://mastodon.social/@a/1", created_at: "2026-11-12T00:00:00Z", content: "<p>We're hiring a product designer! #hiring</p>", in_reply_to_id: null, account: { acct: "a", display_name: "A", url: "https://mastodon.social/@a", followers_count: 10, statuses_count: 5, created_at: "2025-01-01T00:00:00Z" } },
      { id: "2", uri: "u2", url: "https://mastodon.social/@bot/2", created_at: "2026-11-12T00:00:00Z", content: "<p>Job: UX designer #hiring</p>", in_reply_to_id: null, account: { acct: "bot", display_name: "Bot", url: "x", followers_count: 1, statuses_count: 9999, created_at: "2025-01-01T00:00:00Z", bot: true } },
    ]]);
    const r = await mastodon.search!(ctx);
    expect(r.items.map((i) => i.url)).toEqual(["https://mastodon.social/@a/1"]);
  });
});

describe("URL import", () => {
  it("reads schema.org JobPosting data", async () => {
    routes.push([/example\.com\/jobs\/1/, `<html><head><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "JobPosting", title: "Framer Designer", description: "<p>Design and build our Framer site</p>", datePosted: "2026-11-01", employmentType: "CONTRACTOR", hiringOrganization: { name: "Acme" }, jobLocationType: "TELECOMMUTE", baseSalary: { currency: "USD", value: { minValue: 40, maxValue: 60, unitText: "HOUR" } } })}</script></head><body></body></html>`]);
    const { importFromUrl } = await import("../lib/url-import");
    const r = await importFromUrl("https://example.com/jobs/1");
    expect(r.ok).toBe(true);
    expect(r.item).toMatchObject({ title: "Framer Designer", company: "Acme", work_arrangement: "remote", employment_type: "contract", salary_min: 40, currency: "USD" });
  });
  it("refuses private addresses", async () => {
    const { importFromUrl } = await import("../lib/url-import");
    expect((await importFromUrl("http://127.0.0.1/admin")).ok).toBe(false);
    expect((await importFromUrl("http://169.254.169.254/latest")).ok).toBe(false);
  });
  it("doesn't bypass login walls", async () => {
    routes.push([/linkedin\.com/, "<html><head><title>Sign in | LinkedIn</title></head><body>Sign in to view this job. Join now</body></html>"]);
    const { importFromUrl } = await import("../lib/url-import");
    const r = await importFromUrl("https://www.linkedin.com/jobs/view/1");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/login|manually/);
  });
});
