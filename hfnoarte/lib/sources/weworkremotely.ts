import * as cheerio from "cheerio";
import { getText, guessEmploymentType, htmlToText, toIso, truncate } from "./http";
import { looksRelevant } from "./filter";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

const FEEDS = [
  "https://weworkremotely.com/categories/remote-design-jobs.rss",
  "https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss",
];

export const weworkremotely: SourceAdapter = {
  id: "weworkremotely",
  name: "We Work Remotely",
  kinds: ["employment"],
  access: "Public RSS feeds (no key)",
  coverage: "Design and front-end category feeds, filtered locally.",
  availability: () => ({ state: "ready" }),
  async search({ plan }) {
    const items: RawOpportunity[] = [];
    const errors: string[] = [];
    for (const feed of FEEDS) {
      try {
        const $ = cheerio.load(await getText(feed), { xml: true });
        $("item").each((_, el) => {
          const raw = $(el).find("title").first().text();
          const [company, ...rest] = raw.split(":");
          const title = rest.length ? rest.join(":").trim() : raw;
          const description = truncate(htmlToText($(el).find("description").first().text()));
          const region = $(el).find("region").first().text();
          const item: RawOpportunity = {
            source: "weworkremotely", url: $(el).find("link").first().text().trim() || null, kind: "employment",
            title, description, company: rest.length ? company.trim() : null, publisher: rest.length ? company.trim() : null,
            location: region || "Remote", work_arrangement: "remote",
            employment_type: guessEmploymentType($(el).find("type").first().text(), title),
            published_at: toIso($(el).find("pubDate").first().text()), access_method: "Public RSS feed",
          };
          if (looksRelevant(`${title} ${description}`, plan)) items.push(item);
        });
      } catch (e) { errors.push((e as Error).message); }
    }
    const status = errors.length === FEEDS.length ? "failed" : errors.length ? "limited" : "ok";
    return { items, status, message: errors[0], queries: ["design feed", "front-end feed"] };
  },
};
