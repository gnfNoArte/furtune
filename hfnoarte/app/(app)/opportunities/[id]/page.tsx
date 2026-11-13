import Link from "next/link";
import { notFound } from "next/navigation";
import { BandBadge, CredibilityBadge, IntentBadge, KindBadge, ModeBadge, SampleBadge, ScoreRing, SourceBadge, StatusBadge } from "@/components/app/badges";
import { DraftEditor, type DraftRow } from "@/components/app/draft-editor";
import { ApprovalPanel, DeleteButton, PrepareButton, RescoreButton, StatusSelect, TrackingForm } from "@/components/app/opportunity-actions";
import { Card, Notice, SectionTitle } from "@/components/ui";
import { IconExternal } from "@/components/icons";
import { arrangementLabel, employmentLabel, fmtDate, fmtDateTime, relTime } from "@/lib/format";
import { requireUser } from "@/lib/supabase/server";
import { STATUS_LABELS, type Credibility, type Intent, type MatchResult, type OpportunityStatus } from "@/lib/types";

export const metadata = { title: "Opportunity" };

export default async function OpportunityPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ duplicate?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser();
  const { data: o } = await supabase.from("opportunities").select("*, opportunity_links(*)").eq("id", id).maybeSingle();
  if (!o) notFound();
  const [{ data: drafts }, { data: events }] = await Promise.all([
    supabase.from("drafts").select("id, kind, title, content, review_state, generated_mode, warnings, approved_at").eq("opportunity_id", id).order("created_at"),
    supabase.from("opportunity_events").select("event, detail, created_at").eq("opportunity_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const match = o.match as MatchResult | null;
  const cred = o.credibility as Credibility | null;
  const intent = o.intent as Intent | null;
  const links = (o.opportunity_links ?? []) as { id: string; source: string; url: string | null; author: string | null; author_url: string | null; published_at: string | null; access_method: string | null; created_at: string }[];
  const primary = links.find((l) => l.url)?.url ?? null;
  const ds = (drafts ?? []) as DraftRow[];
  const pendingCount = ds.filter((d) => d.review_state === "pending_review").length;
  const facts: [string, React.ReactNode][] = [
    ["Company", o.company], ["Posted by", o.publisher_url ? <a href={o.publisher_url} target="_blank" rel="noopener noreferrer" className="text-violet-bright hover:underline">{o.publisher}</a> : o.publisher],
    ["Location", o.location], ["Arrangement", arrangementLabel(o.work_arrangement)], ["Type", employmentLabel(o.employment_type)],
    ["Pay / budget", o.salary_text ?? "Not disclosed"], ["Posted", o.published_at ? `${fmtDate(o.published_at)} (${relTime(o.published_at)})` : "Date not given by source"],
    ["Discovered", fmtDateTime(o.discovered_at)], ["Approved", o.approved_at ? fmtDateTime(o.approved_at) : "—"], ["Applied", o.applied_at ? fmtDate(o.applied_at) : "—"],
    ["Still open?", o.is_active === false ? (o.activity_note ?? "Probably not") : o.is_active ? "Yes" : "Unknown"],
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/opportunities" className="text-[13px] text-muted hover:text-fg">← Opportunities</Link>
        {sp.duplicate && <Notice tone="info" className="mt-3">You&apos;d already saved this opportunity — the new link was added to it.</Notice>}
        {o.is_sample && <Notice tone="warn" className="mt-3" title="Sample data">This is not a real vacancy or post. It has no original link and exists only to try hfNoArte.</Notice>}
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          <ScoreRing score={o.match_score} band={o.match_band} size={72} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {o.is_sample && <SampleBadge />}<BandBadge band={o.match_band} /><KindBadge kind={o.kind} employmentType={o.employment_type} /><IntentBadge intent={intent} /><CredibilityBadge c={cred} /><StatusBadge status={o.status as OpportunityStatus} /><ModeBadge mode={o.analysis_mode} />
            </div>
            <h1 className="mt-2.5 text-[24px] font-semibold leading-tight tracking-tight sm:text-[28px]">{o.title}</h1>
            <p className="mt-1 text-muted">{[o.company ?? o.publisher, o.location].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {primary && <a href={primary} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-violet px-4 text-sm font-medium text-white hover:bg-violet-bright"><IconExternal width={16} height={16} /> Open original</a>}
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          {match && (
            <section>
              <SectionTitle action={<RescoreButton id={o.id} />}>Why this score</SectionTitle>
              <Card className="p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="eyebrow mb-2 text-strong">Where you match</p>
                    {match.reasons.length ? <ul className="space-y-1.5 text-sm">{match.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="text-sm text-muted">No clear overlap found.</p>}
                  </div>
                  <div>
                    <p className="eyebrow mb-2 text-stretch">Gaps &amp; requirements</p>
                    {match.gaps.length ? <ul className="space-y-1.5 text-sm">{match.gaps.map((g) => <li key={g}>{g}</li>)}</ul> : <p className="text-sm text-muted">Nothing missing that we could see.</p>}
                  </div>
                </div>
                <div className="mt-5 grid gap-3 border-t border-line pt-5 text-sm sm:grid-cols-2">
                  <p><span className="text-muted">Experience level · </span>{match.experience_fit}</p>
                  <p><span className="text-muted">Can you deliver it? · </span>{match.deliverable}</p>
                </div>
                <div className="mt-5 space-y-2.5 border-t border-line pt-5">
                  {match.components.map((c) => (
                    <div key={c.key} className="grid grid-cols-[130px_1fr_44px] items-center gap-3 text-[13px] sm:grid-cols-[180px_1fr_52px]">
                      <span className="text-muted">{c.label}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-violet" style={{ width: `${(c.score / c.max) * 100}%` }} /></span>
                      <span className="text-right tabular-nums text-faint">{c.score}/{c.max}</span>
                      <span className="col-span-3 -mt-1 text-[12px] text-faint">{c.note}</span>
                    </div>
                  ))}
                </div>
                {match.caps.length > 0 && <div className="mt-4 space-y-1 text-[12.5px] text-stretch">{match.caps.map((c) => <p key={c}>Capped: {c}</p>)}</div>}
                <p className="mt-4 text-[12px] text-faint">{match.mode === "ai" ? "AI judged skill, experience and level fit; location, type and pay are rule-based, and the app's caps still apply." : "Scored by transparent keyword rules (AI not used for this item)."}</p>
              </Card>
            </section>
          )}

          <section>
            <SectionTitle action={<PrepareButton id={o.id} hasDrafts={ds.length > 0} />}>{o.kind === "employment" ? "Application material" : "Comment, message & proposal"}</SectionTitle>
            {o.kind !== "employment" && <p className="mb-3 text-sm text-muted">hfNoArte never posts or sends messages. Approve these, then paste them on the original post yourself.</p>}
            {ds.length ? <div className="space-y-4">{ds.map((d) => <DraftEditor key={d.id} d={d} />)}</div> : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-muted">Nothing prepared yet. Drafts are written only from your profile and go straight to Review &amp; Approve.</p>}
          </section>

          <section>
            <SectionTitle>Description</SectionTitle>
            <Card className="p-5"><div className="prose-plain text-[14px] text-fg/90">{o.description || "No description."}</div></Card>
          </section>
        </div>

        <aside className="space-y-6">
          <Card className="space-y-4 p-5">
            <p className="text-[15px] font-semibold">Approval</p>
            <ApprovalPanel id={o.id} approvedAt={o.approved_at} pendingCount={pendingCount} url={primary} status={o.status} />
          </Card>

          <Card className="p-5">
            <StatusSelect id={o.id} status={o.status} approved={!!o.approved_at} />
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-[15px] font-semibold">Details</p>
            <dl className="space-y-2 text-[13px]">
              {facts.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[100px_1fr] gap-2"><dt className="text-faint">{k}</dt><dd className="min-w-0 break-words">{v || "—"}</dd></div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <p className="mb-1 text-[15px] font-semibold">Where it was found</p>
            <p className="mb-3 text-[12px] text-faint">Every known source link is kept.</p>
            <ul className="space-y-3 text-[13px]">
              {links.map((l) => (
                <li key={l.id} className="space-y-1">
                  <div className="flex items-center gap-2"><SourceBadge source={l.source} /><span className="text-faint">{l.access_method}</span></div>
                  {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" className="block truncate text-violet-bright hover:underline">{l.url}</a> : <p className="text-faint">No link</p>}
                  {l.author && <p className="text-faint">By {l.author}</p>}
                </li>
              ))}
              {!links.length && <li className="text-faint">{o.is_sample ? "Sample data — no source." : "Entered manually."}</li>}
            </ul>
          </Card>

          {cred && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2"><p className="text-[15px] font-semibold">Credibility</p><CredibilityBadge c={cred} /></div>
              <ul className="space-y-2 text-[13px]">
                {cred.evidence.map((e, i) => (
                  <li key={i} className="flex gap-2">
                    <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${e.effect === "positive" ? "bg-strong" : e.effect === "negative" ? "bg-danger" : "bg-faint"}`} />
                    <span><span className="text-muted">{e.signal}: </span>{e.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-faint">Small or new accounts aren&apos;t rejected — many genuine founders have little history.</p>
            </Card>
          )}
          {intent && intent.label !== "vacancy" && <Card className="p-5 text-[13px]"><p className="mb-1 text-[15px] font-semibold">Intent</p><p className="text-muted">{intent.reason} <span className="text-faint">({intent.mode === "ai" ? "AI" : "keyword rules"})</span></p></Card>}
        </aside>
      </div>

      <section>
        <SectionTitle>Tracking</SectionTitle>
        <Card className="p-5">
          <TrackingForm id={o.id} initial={{ notes: o.notes, follow_up_date: o.follow_up_date, interview_at: o.interview_at, interview_notes: o.interview_notes, applied_at: o.applied_at, documents: o.documents ?? [] }} />
        </Card>
      </section>

      {(events ?? []).length > 0 && (
        <section>
          <SectionTitle>Activity</SectionTitle>
          <ul className="space-y-1.5 text-[13px] text-muted">
            {(events ?? []).map((e, i) => (
              <li key={i}><span className="text-faint">{fmtDateTime(e.created_at)} · </span>{e.event === "status" ? `Status: ${STATUS_LABELS[(e.detail as { from: OpportunityStatus }).from]} → ${STATUS_LABELS[(e.detail as { to: OpportunityStatus }).to]}` : e.event === "approved" ? "Approved by you" : e.event}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex justify-end border-t border-line pt-6"><DeleteButton id={o.id} /></div>
    </div>
  );
}
