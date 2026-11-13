import Link from "next/link";
import { redirect } from "next/navigation";
import { OPPORTUNITY_LIST_COLUMNS, OpportunityCard, type OpportunityListItem } from "@/components/app/opportunity-card";
import { RunDiscoveryButton } from "@/components/app/run-discovery";
import { EmptyState, LinkButton, Notice, SectionTitle, Stat } from "@/components/ui";
import { IconCheckCircle, IconLink, IconRadar, IconUpload } from "@/components/icons";
import { aiAvailable } from "@/lib/ai/client";
import { relTime } from "@/lib/format";
import { sourceName } from "@/lib/sources";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

const ACTIVE = "(new,saved,reviewing,interested,message_prepared)";

export default async function Dashboard() {
  const { supabase, user } = await requireUser();
  const { data: cp } = await supabase.from("candidate_profiles").select("full_name, origin").eq("user_id", user.id).maybeSingle();
  if (!cp) redirect("/onboarding");

  const count = (q: any) => q.then((r: { count: number | null }) => r.count ?? 0);
  const opp = () => supabase.from("opportunities").select("id", { count: "exact", head: true });
  const [matched, pending, approved, applied, interviews, offers, samples, top, recent, runs] = await Promise.all([
    count(opp().eq("is_sample", false).in("match_band", ["strong", "reasonable", "stretch"])),
    count(supabase.from("drafts").select("opportunity_id", { count: "exact", head: true }).eq("review_state", "pending_review")),
    count(opp().not("approved_at", "is", null).filter("status", "in", ACTIVE)),
    count(opp().in("status", ["applied", "contacted", "follow_up"])),
    count(opp().eq("status", "interview")),
    count(opp().eq("status", "won")),
    count(opp().eq("is_sample", true)),
    supabase.from("opportunities").select(OPPORTUNITY_LIST_COLUMNS).filter("status", "in", ACTIVE).neq("match_band", "poor").order("match_score", { ascending: false }).limit(10),
    supabase.from("opportunities").select(OPPORTUNITY_LIST_COLUMNS).order("discovered_at", { ascending: false }).limit(5),
    supabase.from("discovery_runs").select("id, trigger, status, started_at, found, new_count, merged_count, analysis_mode, error").order("started_at", { ascending: false }).limit(5),
  ]);
  const topItems = (top.data ?? []) as unknown as OpportunityListItem[];
  const recentItems = (recent.data ?? []) as unknown as OpportunityListItem[];
  const lastRun = runs.data?.[0];
  const { data: lastSources } = lastRun
    ? await supabase.from("source_runs").select("source, status, found, kept").eq("run_id", lastRun.id)
    : { data: [] as { source: string; status: string; found: number; kept: number }[] };
  const name = cp.full_name?.split(" ")[0] || user.email?.split("@")[0];
  const ai = aiAvailable();

  return (
    <div className="space-y-12">
      <header className="rise flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-3">Dashboard</p>
          <h1 className="display text-[44px] font-light sm:text-[64px]">Welcome back{name ? <>, <em className="italic text-accent">{name}</em></> : ""}.</h1>
          <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.06em] text-muted">
            {lastRun ? <>Last search {relTime(lastRun.started_at)} · {lastRun.new_count} new · {lastRun.found} items read</> : "No searches yet — run your first one."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/opportunities/new"><IconLink width={16} height={16} /> Add by URL</LinkButton>
          <RunDiscoveryButton />
        </div>
      </header>

      {!ai && (
        <Notice tone="warn" title="Fallback mode: keyword matching">
          No AI key is configured, so scores, intent detection and drafts use transparent keyword rules and templates — not AI analysis. Add a free Gemini or Groq key to enable AI (see README).
        </Notice>
      )}
      {samples > 0 && (
        <Notice tone="warn" title={`${samples} sample opportunities are loaded`}>
          They're marked SAMPLE and aren't real vacancies. Remove them any time from Opportunities.
        </Notice>
      )}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Matched" value={matched} hint="Real, scored" href="/opportunities" />
        <Stat label="Pending review" value={pending} hint="Drafts to check" href="/review" />
        <Stat label="Approved" value={approved} hint="Ready to use" href="/tracker" />
        <Stat label="Applied / contacted" value={applied} href="/tracker" />
        <Stat label="Interviews" value={interviews} href="/tracker" />
        <Stat label="Offers / won" value={offers} href="/tracker" />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <SectionTitle action={<Link href="/opportunities" className="text-[13px] link">All opportunities</Link>}>Top matches</SectionTitle>
          {topItems.length ? (
            <div className="space-y-3">{topItems.map((o) => <OpportunityCard key={o.id} o={o} />)}</div>
          ) : (
            <EmptyState icon={<IconRadar />} title="No matches yet"
              body="Run a search to check every free source, or paste a link you've found. You can also load clearly labelled sample data to try the app."
              action={<><RunDiscoveryButton /><LinkButton href="/opportunities/new">Add by URL</LinkButton></>} />
          )}
        </section>

        <aside className="space-y-8">
          <section>
            <SectionTitle>Quick actions</SectionTitle>
            <div className="grid gap-2">
              {[
                { href: "/review", icon: IconCheckCircle, label: "Review & approve", sub: pending ? `${pending} drafts waiting` : "Nothing waiting" },
                { href: "/opportunities/new", icon: IconLink, label: "Add an opportunity", sub: "From a link or by hand" },
                { href: "/profile#resume", icon: IconUpload, label: "Upload resume", sub: cp.origin === "resume" ? "Profile built from resume" : "Make your profile exact" },
                { href: "/sources", icon: IconRadar, label: "Source status", sub: "What was searched, and how" },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="card flex items-center gap-3 px-3.5 py-3 transition-colors hover:border-line-strong">
                  <span className="grid size-9 place-items-center rounded-full bg-butter text-ink"><a.icon /></span>
                  <span className="min-w-0"><span className="block text-sm font-medium">{a.label}</span><span className="block truncate text-xs text-faint">{a.sub}</span></span>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <SectionTitle action={<Link href="/sources" className="text-[13px] link">Details</Link>}>Search activity</SectionTitle>
            <div className="card divide-y divide-line">
              {(runs.data ?? []).length === 0 && <p className="p-4 text-sm text-muted">No searches have run yet. Daily searches start once the scheduler is set up (see README).</p>}
              {(runs.data ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13px]">
                  <div>
                    <p className="font-medium">{r.trigger === "cron" ? "Daily search" : "Manual search"}</p>
                    <p className="text-faint">{relTime(r.started_at)} · {r.analysis_mode ?? "—"}</p>
                  </div>
                  <p className={r.status === "failed" ? "text-danger" : "text-muted"}>{r.status === "running" ? "Running…" : `${r.new_count} new · ${r.found} read`}</p>
                </div>
              ))}
              {lastSources && lastSources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-4 py-3">
                  {lastSources.map((s) => (
                    <span key={s.source} title={`${s.found} read, ${s.kept} kept`} className={`rounded-full border px-2 py-0.5 text-[11px] ${s.status === "failed" ? "border-danger/30 text-danger" : s.status === "skipped" ? "border-line text-faint" : s.status === "limited" ? "border-stretch/30 text-stretch" : "border-strong/25 text-strong"}`}>
                      {sourceName(s.source)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {recentItems.length > 0 && (
            <section>
              <SectionTitle>Recently found</SectionTitle>
              <div className="space-y-2">{recentItems.map((o) => <OpportunityCard key={o.id} o={o} compact />)}</div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
