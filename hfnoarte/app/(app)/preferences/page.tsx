import { savePreferences } from "@/app/actions/settings";
import { CheckChip, SettingsForm, Toggle } from "@/components/app/settings-form";
import { Card, Field, PageHeader, SectionTitle } from "@/components/ui";
import { loadPreferences, loadProfile } from "@/lib/data";
import { buildPlan } from "@/lib/discovery/plan";
import { SOURCES } from "@/lib/sources";
import { requireUser } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES } from "@/lib/taxonomy";

export const metadata = { title: "Preferences" };

const COUNTRIES = { gb: "United Kingdom", us: "United States", ca: "Canada", au: "Australia", nz: "New Zealand", za: "South Africa", in: "India", sg: "Singapore", de: "Germany", fr: "France", nl: "Netherlands", it: "Italy", es: "Spain", at: "Austria", be: "Belgium", ch: "Switzerland", pl: "Poland", br: "Brazil", mx: "Mexico" };

export default async function Preferences() {
  const { supabase, user } = await requireUser();
  const p = await loadPreferences(supabase, user.id);
  const profile = await loadProfile(supabase, user.id);
  const plan = profile ? buildPlan(profile, p) : null;
  const searchable = SOURCES.filter((s) => s.search);
  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Preferences" title="What to hunt for" description="Starting points, not limits — hfNoArte also searches related titles and understands posts that use different words." />
      <SettingsForm action={savePreferences} submit="Save preferences">
        <section>
          <SectionTitle>Opportunity types</SectionTitle>
          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap gap-2">
              <CheckChip name="opportunity_kinds" value="employment" label="Jobs" defaultChecked={p.opportunity_kinds.includes("employment")} />
              <CheckChip name="opportunity_kinds" value="freelance" label="Freelance & client projects" defaultChecked={p.opportunity_kinds.includes("freelance")} />
              <CheckChip name="opportunity_kinds" value="social" label="Social posts & comments" defaultChecked={p.opportunity_kinds.includes("social")} />
            </div>
            <Toggle name="include_internships" label="Include internships" defaultChecked={p.include_internships} />
            <div>
              <p className="label">Employment types</p>
              <div className="flex flex-wrap gap-2">
                {[["full_time", "Full-time"], ["part_time", "Part-time"], ["contract", "Contract"], ["internship", "Internship"], ["freelance", "Freelance"], ["graduate", "Graduate"]].map(([v, l]) => <CheckChip key={v} name="employment_types" value={v} label={l} defaultChecked={p.employment_types.includes(v)} />)}
              </div>
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle>Titles &amp; keywords</SectionTitle>
          <Card className="space-y-4 p-5">
            <Field label="Target job titles" htmlFor="tt" hint={<>One per line or comma-separated. Suggested categories: {DEFAULT_CATEGORIES.join(" · ")}.</>}>
              <textarea id="tt" name="target_titles" rows={4} className="field" defaultValue={p.target_titles.join("\n")} />
            </Field>
            <Field label="Extra search keywords" htmlFor="kw" hint="Tools or terms, e.g. webflow, framer, shopify, figma, web3."><textarea id="kw" name="keywords" rows={2} className="field" defaultValue={p.keywords.join(", ")} /></Field>
            <Field label="Exclude anything mentioning" htmlFor="ex" hint="e.g. unpaid, commission only, wordpress."><textarea id="ex" name="excluded_keywords" rows={2} className="field" defaultValue={p.excluded_keywords.join(", ")} /></Field>
            {plan && (
              <details className="rounded-xl border border-line bg-surface-2 p-4 text-[13px]">
                <summary className="cursor-pointer text-muted hover:text-fg">See exactly what will be searched</summary>
                <p className="mt-3"><span className="text-faint">Titles: </span>{plan.titles.join(", ")}</p>
                <p className="mt-2"><span className="text-faint">Keywords: </span>{plan.keywords.join(", ")}</p>
                <p className="mt-2"><span className="text-faint">Social phrases: </span>{plan.phrases.map((x) => `“${x}”`).join(", ")}</p>
              </details>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>Location &amp; pay</SectionTitle>
          <Card className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Preferred locations" htmlFor="loc" hint="Cities or countries. Remote roles are matched by the arrangement below."><input id="loc" name="locations" className="field" defaultValue={p.locations.join(", ")} placeholder="e.g. Lagos, London" /></Field></div>
            <div className="sm:col-span-2">
              <p className="label">Work arrangement</p>
              <div className="flex flex-wrap gap-2">
                {[["remote", "Remote"], ["hybrid", "Hybrid"], ["onsite", "On-site"]].map(([v, l]) => <CheckChip key={v} name="work_arrangements" value={v} label={l} defaultChecked={(p.work_arrangements as string[]).includes(v)} />)}
              </div>
            </div>
            <Field label="Minimum salary or stipend" htmlFor="ms" hint="Per year for jobs; leave blank to skip."><input id="ms" name="min_salary" inputMode="numeric" className="field" defaultValue={p.min_salary ?? ""} /></Field>
            <Field label="Currency" htmlFor="cur"><input id="cur" name="currency" className="field" defaultValue={p.currency} maxLength={3} /></Field>
            <Field label="Adzuna country" htmlFor="ac" hint="Adzuna searches one country at a time.">
              <select id="ac" name="adzuna_country" className="field" defaultValue={p.adzuna_country}>{Object.entries(COUNTRIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </Field>
          </Card>
        </section>

        <section>
          <SectionTitle>Sources &amp; schedule</SectionTitle>
          <Card className="space-y-4 p-5">
            <Toggle name="daily_discovery" label="Search every day" hint="Runs on the server schedule (see README). You can always search manually." defaultChecked={p.daily_discovery} />
            <Toggle name="all_sources" label="Use every available source" hint="Turn off to choose below." defaultChecked={p.enabled_sources === null} />
            <div className="flex flex-wrap gap-2">
              {searchable.map((s) => <CheckChip key={s.id} name="enabled_sources" value={s.id} label={s.name} defaultChecked={p.enabled_sources === null || p.enabled_sources.includes(s.id)} />)}
            </div>
            <Field label="Company career pages" htmlFor="cb" hint="Companies using Greenhouse, Lever or Ashby: write provider:name, e.g. greenhouse:figma, lever:netflix, ashby:linear (the name in their jobs-page URL).">
              <textarea id="cb" name="company_boards" rows={2} className="field" defaultValue={p.company_boards.join(", ")} />
            </Field>
          </Card>
        </section>
      </SettingsForm>
    </div>
  );
}
