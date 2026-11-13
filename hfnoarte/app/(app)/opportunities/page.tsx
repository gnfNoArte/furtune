import Link from "next/link";
import { OPPORTUNITY_LIST_COLUMNS, OpportunityCard, type OpportunityListItem } from "@/components/app/opportunity-card";
import { RunDiscoveryButton } from "@/components/app/run-discovery";
import { SampleButtons } from "@/components/app/sample-buttons";
import { EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { IconPlus, IconRadar } from "@/components/icons";
import { SOURCES } from "@/lib/sources";
import { requireUser } from "@/lib/supabase/server";
import { STATUS_LABELS, OPPORTUNITY_STATUSES } from "@/lib/types";

export const metadata = { title: "Opportunities" };

type SP = { band?: string; kind?: string; status?: string; source?: string; q?: string; sort?: string };

export default async function Opportunities({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase } = await requireUser();

  let q = supabase.from("opportunities").select(sp.source ? OPPORTUNITY_LIST_COLUMNS.replace("opportunity_links(", "opportunity_links!inner(") : OPPORTUNITY_LIST_COLUMNS);
  if (sp.band) q = q.eq("match_band", sp.band);
  else q = q.neq("match_band", "poor");
  if (sp.kind) q = q.eq("kind", sp.kind);
  if (sp.status) q = q.eq("status", sp.status);
  else q = q.not("status", "in", "(rejected,expired)");
  if (sp.source) q = q.eq("opportunity_links.source", sp.source);
  if (sp.q) q = q.or(`title.ilike.%${sp.q.replace(/[%,()]/g, " ")}%,company.ilike.%${sp.q.replace(/[%,()]/g, " ")}%,description.ilike.%${sp.q.replace(/[%,()]/g, " ")}%`);
  q = sp.sort === "recent" ? q.order("discovered_at", { ascending: false }) : q.order("match_score", { ascending: false, nullsFirst: false });
  const { data, error } = await q.limit(100);
  const items = (data ?? []) as unknown as OpportunityListItem[];
  const { count: sampleCount } = await supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("is_sample", true);

  const chip = (key: keyof SP, value: string | undefined, label: string) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    if (value) next.set(key, value); else next.delete(key);
    const on = (sp[key] ?? undefined) === value;
    return (
      <Link key={`${key}-${value}`} href={`/opportunities?${next}`} aria-current={on ? "true" : undefined}
        className={cx("rounded-full border px-3 py-1 text-[12.5px] transition-colors", on ? "border-violet/40 bg-violet-wash text-violet-bright" : "border-line text-muted hover:border-line-strong hover:text-fg")}>{label}</Link>
    );
  };

  return (
    <div>
      <PageHeader eyebrow="Opportunities" title="Everything worth your time"
        description="Ranked by how well each one fits your real experience. Poor matches, rejected and expired items are hidden unless you filter for them."
        actions={<><SampleButtons hasSamples={(sampleCount ?? 0) > 0} /><LinkButton href="/opportunities/new"><IconPlus width={16} height={16} /> Add</LinkButton><RunDiscoveryButton /></>} />

      <form className="mb-4" action="/opportunities">
        {Object.entries(sp).filter(([k, v]) => v && k !== "q").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input name="q" defaultValue={sp.q} placeholder="Search title, company or description…" className="field h-11" aria-label="Search opportunities" />
      </form>
      <div className="mb-6 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">{chip("band", undefined, "All matches")}{chip("band", "strong", "Strong")}{chip("band", "reasonable", "Reasonable")}{chip("band", "stretch", "Stretch")}{chip("band", "poor", "Poor")}</div>
        <div className="flex flex-wrap gap-1.5">{chip("kind", undefined, "All types")}{chip("kind", "employment", "Jobs")}{chip("kind", "freelance", "Freelance")}{chip("kind", "social", "Social posts")}
          <span className="mx-1 w-px bg-line" />{chip("sort", undefined, "Best match")}{chip("sort", "recent", "Most recent")}</div>
        <details className="text-[13px] text-muted">
          <summary className="cursor-pointer select-none hover:text-fg">More filters</summary>
          <div className="mt-2.5 space-y-2.5">
            <div className="flex flex-wrap gap-1.5">{chip("status", undefined, "Any open status")}{OPPORTUNITY_STATUSES.map((s) => chip("status", s, STATUS_LABELS[s]))}</div>
            <div className="flex flex-wrap gap-1.5">{chip("source", undefined, "All sources")}{[...SOURCES.filter((s) => s.search).map((s) => [s.id, s.name]), ["url", "Added by URL"], ["manual", "Manual"]].map(([id, n]) => chip("source", id, n))}</div>
          </div>
        </details>
      </div>

      {error && <p className="text-danger">{error.message}</p>}
      {items.length ? (
        <>
          <p className="mb-3 text-[13px] text-faint">{items.length} shown{items.length === 100 ? " (first 100)" : ""}{!sp.sort && !sp.band ? " · top 10 highlighted" : ""}</p>
          <div className="space-y-3">
            {items.map((o, i) => (
              <div key={o.id} className={!sp.sort && !sp.band && i < 10 ? "" : "opacity-95"}>
                {!sp.sort && !sp.band && i === 10 && <p className="eyebrow mb-3 mt-6">More opportunities</p>}
                <OpportunityCard o={o} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState icon={<IconRadar />} title={Object.values(sp).some(Boolean) ? "Nothing matches these filters" : "No opportunities yet"}
          body={Object.values(sp).some(Boolean) ? "Try clearing a filter." : "Run a search across the free sources, paste a link, or load sample data to explore."}
          action={<><RunDiscoveryButton /><LinkButton href="/opportunities/new">Add by URL</LinkButton></>} />
      )}
    </div>
  );
}
