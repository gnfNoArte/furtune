"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approve, rejectApplication } from "@/app/actions/drafts";
import { Button, Notice } from "../ui";
import { BandBadge, KindBadge, SampleBadge, ScoreRing } from "./badges";
import { DraftEditor, type DraftRow } from "./draft-editor";
import { IconExternal } from "../icons";
import type { MatchBand } from "@/lib/types";

export interface ReviewItem {
  id: string; title: string; company: string | null; publisher: string | null; kind: string; employment_type: string | null;
  match_score: number | null; match_band: MatchBand | null; is_sample: boolean; url: string | null; description: string | null;
  reasons: string[]; gaps: string[]; drafts: DraftRow[];
}

export function ReviewQueue({ items }: { items: ReviewItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "butter" | "danger"; text: string } | null>(null);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const doApprove = (ids: string[]) => start(async () => {
    const r = await approve(ids);
    if (r.error) setMsg({ tone: "danger", text: r.error });
    else if (r.failed?.length) setMsg({ tone: "danger", text: `${r.approved} approved; ${r.failed.length} couldn't be: ${r.failed[0].message}` });
    else router.replace(`/review?approved=${r.approved}`, { scroll: false });
    setSelected(new Set());
  });

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="size-4 accent-[#1B1A17]" checked={selected.size === items.length && items.length > 0}
            onChange={(e) => setSelected(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} />
          Select all
        </label>
        <span className="text-sm text-faint">{selected.size} selected</span>
        <Button className="ml-auto" variant="primary" size="sm" disabled={!selected.size || pending}
          onClick={() => { if (confirm(`Approve ${selected.size} application${selected.size === 1 ? "" : "s"}? Nothing will be submitted — you'll still apply or send each one yourself.`)) doApprove([...selected]); }}>
          Approve selected
        </Button>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {items.map((it) => (
        <article key={it.id} className="card overflow-hidden">
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <input type="checkbox" aria-label={`Select ${it.title}`} className="mt-1.5 size-4 shrink-0 accent-[#1B1A17]" checked={selected.has(it.id)} onChange={() => toggle(it.id)} />
            <ScoreRing score={it.match_score} band={it.match_band} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-1.5">{it.is_sample && <SampleBadge />}<BandBadge band={it.match_band} /><KindBadge kind={it.kind} employmentType={it.employment_type} /></div>
              <h3 className="mt-1.5 font-semibold tracking-tight"><Link href={`/opportunities/${it.id}`} className="hover:underline">{it.title}</Link></h3>
              <p className="text-[13px] text-muted">{it.company ?? it.publisher ?? "Unknown publisher"} · {it.drafts.length} item{it.drafts.length === 1 ? "" : "s"} to review</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setOpen(open === it.id ? null : it.id)} aria-expanded={open === it.id}>{open === it.id ? "Collapse" : "Review"}</Button>
          </div>
          {open === it.id && (
            <div className="space-y-4 border-t border-line bg-bg/40 p-4 sm:p-5">
              <div className="grid gap-4 text-[13px] sm:grid-cols-2">
                <div><p className="eyebrow mb-1.5">Why it matches</p>{it.reasons.slice(0, 3).map((r) => <p key={r} className="text-muted">{r}</p>)}</div>
                <div><p className="eyebrow mb-1.5">Gaps</p>{it.gaps.length ? it.gaps.slice(0, 3).map((g) => <p key={g} className="text-muted">{g}</p>) : <p className="text-muted">None noted.</p>}</div>
              </div>
              <details className="rounded-xl border border-line bg-surface p-4 text-[13px]">
                <summary className="cursor-pointer text-muted hover:text-fg">Preview the job / post</summary>
                <div className="prose-plain mt-3 max-h-80 overflow-auto text-fg/85">{it.description}</div>
                {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 link">Open original <IconExternal width={14} height={14} /></a>}
              </details>
              {it.drafts.map((d) => <DraftEditor key={d.id} d={d} />)}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="primary" disabled={pending} onClick={() => doApprove([it.id])}>Approve application</Button>
                <Button variant="ghost" disabled={pending} onClick={() => start(async () => { await rejectApplication(it.id); })}>Reject</Button>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
