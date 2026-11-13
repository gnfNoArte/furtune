import { getJson, guessArrangement, guessEmploymentType, htmlToText, toIso } from "./http";
import type { SourceAdapter } from "./types";
import type { RawOpportunity } from "../types";

const CURRENCY: Record<string, string> = {
  gb: "GBP", us: "USD", ca: "CAD", au: "AUD", nz: "NZD", za: "ZAR", in: "INR", sg: "SGD",
  de: "EUR", fr: "EUR", nl: "EUR", it: "EUR", es: "EUR", at: "EUR", be: "EUR", pl: "PLN", br: "BRL", mx: "MXN", ch: "CHF",
};

interface AdzunaJob {
  id: string; title: string; description: string; created: string; redirect_url: string;
  company?: { display_name?: string }; location?: { display_name?: string };
  salary_min?: number; salary_max?: number; salary_is_predicted?: string;
  contract_time?: string; contract_type?: string;
}

export const adzuna: SourceAdapter = {
  id: "adzuna",
  name: "Adzuna",
  kinds: ["employment"],
  access: "Official Adzuna API (free developer key)",
  coverage: "Aggregated job-board vacancies for one country per search. Descriptions are snippets.",
  availability() {
    return process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY
      ? { state: "ready" }
      : { state: "not_configured", note: "Needs a free Adzuna developer key.", setup: "Register at developer.adzuna.com and set ADZUNA_APP_ID and ADZUNA_APP_KEY." };
  },
  async search({ plan, prefs }) {
    const country = (prefs.adzuna_country || "gb").toLowerCase();
    const locations = plan.locations.filter((l) => !/remote|anywhere|worldwide/i.test(l)).slice(0, 2);
    const wheres = locations.length ? locations : [""];
    const titles = plan.titles.slice(0, 6);
    const queries: string[] = [];
    const items: RawOpportunity[] = [];
    let failures = 0;
    let lastError = "";
    for (const what of titles) {
      for (const where of wheres) {
        const q = new URLSearchParams({
          app_id: process.env.ADZUNA_APP_ID!, app_key: process.env.ADZUNA_APP_KEY!,
          what_phrase: what, results_per_page: "20", max_days_old: "21", sort_by: "date",
          "content-type": "application/json",
        });
        if (where) q.set("where", where);
        queries.push(`${what}${where ? ` in ${where}` : ""}`);
        try {
          const data = await getJson<{ results: AdzunaJob[] }>(`https://api.adzuna.com/v1/api/jobs/${country}/search/1?${q}`);
          for (const j of data.results ?? []) {
            const description = htmlToText(j.description);
            const predicted = j.salary_is_predicted === "1";
            items.push({
              source: "adzuna", external_id: String(j.id), url: j.redirect_url, kind: "employment",
              title: htmlToText(j.title), description, company: j.company?.display_name ?? null,
              publisher: j.company?.display_name ?? null, location: j.location?.display_name ?? null,
              work_arrangement: guessArrangement(j.title, description, j.location?.display_name),
              employment_type: guessEmploymentType(j.contract_time, j.contract_type, j.title),
              salary_min: predicted ? null : j.salary_min ?? null,
              salary_max: predicted ? null : j.salary_max ?? null,
              salary_text: !predicted && (j.salary_min || j.salary_max) ? `${j.salary_min ?? ""}${j.salary_max && j.salary_max !== j.salary_min ? `–${j.salary_max}` : ""} ${CURRENCY[country] ?? ""}`.trim() : null,
              currency: CURRENCY[country] ?? null,
              published_at: toIso(j.created), access_method: "Official API",
            });
          }
        } catch (e) {
          failures++;
          lastError = (e as Error).message;
        }
      }
    }
    if (failures === queries.length) return { items, status: "failed", message: lastError, queries };
    return { items, status: failures ? "limited" : "ok", message: failures ? `${failures} of ${queries.length} searches failed: ${lastError}` : undefined, queries };
  },
};
