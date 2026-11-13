"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { revoke } from "@/app/actions/drafts";
import { setStatus } from "@/app/actions/opportunities";
import { Notice, cx } from "../ui";
import { SampleBadge, ScoreRing, StatusBadge } from "./badges";
import { IconExternal } from "../icons";
import { fmtDate } from "@/lib/format";
import type { MatchBand, OpportunityStatus } from "@/lib/types";

export interface TrackerItem {
  id: string; title: string; company: string | null; publisher: string | null; status: OpportunityStatus; approved_at: string | null;
  discovered_at: string; applied_at: string | null; interview_at: string | null; follow_up_date: string | null; notes: string | null;
  match_score: number | null; match_band: MatchBand | null; is_sample: boolean; url: string | null; documents: { label: string; url: string }[];
}

export const COLUMNS = ["saved", "approved", "applied", "interview", "offer", "rejected"] as const;
type Column = (typeof COLUMNS)[number];
const TITLES: Record<Column, string> = { saved: "Saved", approved: "Approved", applied: "Applied", interview: "Interview", offer: "Offer", rejected: "Rejected" };
const ACCENT: Record<Column, string> = { saved: "bg-faint", approved: "bg-violet", applied: "bg-info", interview: "bg-stretch", offer: "bg-strong", rejected: "bg-danger" };

export function columnOf(o: Pick<TrackerItem, "status" | "approved_at">): Column | null {
  if (o.status === "rejected") return "rejected";
  if (o.status === "won") return "offer";
  if (o.status === "interview") return "interview";
  if (["applied", "contacted", "follow_up"].includes(o.status)) return "applied";
  if (o.approved_at) return "approved";
  if (["saved", "reviewing", "interested", "message_prepared"].includes(o.status)) return "saved";
  return null;
}

const TARGET: Record<Column, OpportunityStatus | null> = { saved: "saved", approved: null, applied: "applied", interview: "interview", offer: "won", rejected: "rejected" };

export function TrackerBoard({ items, view }: { items: TrackerItem[]; view: "board" | "list" }) {
  const [optimistic, move] = useOptimistic(items, (state, { id, col }: { id: string; col: Column }) =>
    state.map((i) => (i.id === id ? { ...i, status: TARGET[col] ?? i.status, approved_at: col === "saved" ? null : i.approved_at } : i)));
  const [, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);

  const moveTo = (it: TrackerItem, col: Column) => {
    setErr(null);
    if (columnOf(it) === col) return;
    if (col === "approved") { setErr("Approve applications in Review & Approve — moving a card can't approve it."); return; }
    if (["applied", "interview", "offer"].includes(col) && !it.approved_at) { setErr(`"${it.title}" hasn't been approved yet. Approve it in Review & Approve first.`); return; }
    if (col === "applied" && !confirm("Only mark this as applied once you've actually submitted it. Continue?")) return;
    start(async () => {
      move({ id: it.id, col });
      if (col === "saved" && it.approved_at) {
        const r = await revoke(it.id);
        if (r.error) { setErr(r.error); return; }
      }
      const r = await setStatus(it.id, TARGET[col]!);
      if (r.error) setErr(r.error);
    });
  };

  const renderCard = (it: TrackerItem) => (
    <div key={it.id} draggable onDragStart={() => setDrag(it.id)} onDragEnd={() => setDrag(null)}
      className={cx("card cursor-grab p-3.5 active:cursor-grabbing", drag === it.id && "opacity-50", it.is_sample && "border-stretch/30")}>
      <div className="flex items-start gap-2.5">
        <ScoreRing score={it.match_score} band={it.match_band} size={34} />
        <div className="min-w-0 flex-1">
          {it.is_sample && <span className="block text-[10.5px] font-semibold tracking-wide text-stretch">SAMPLE · NOT REAL</span>}
          <Link href={`/opportunities/${it.id}`} className="mt-0.5 line-clamp-2 block text-[13.5px] font-medium leading-snug hover:underline">{it.title}</Link>
          <p className="truncate text-[12px] text-muted">{it.company ?? it.publisher ?? "—"}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-faint">
        <span>Found {fmtDate(it.discovered_at)}</span>
        {it.applied_at && <span>· Applied {fmtDate(it.applied_at)}</span>}
        {it.interview_at && <span className="text-stretch">· Interview {fmtDate(it.interview_at)}</span>}
        {it.follow_up_date && <span>· Follow up {fmtDate(it.follow_up_date)}</span>}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <select aria-label="Move to" className="field h-8 py-0 text-[12px]" value={columnOf(it) ?? ""} onChange={(e) => moveTo(it, e.target.value as Column)}>
          {COLUMNS.map((c) => <option key={c} value={c}>{TITLES[c]}</option>)}
        </select>
        {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer" aria-label="Open original" className="grid size-8 shrink-0 place-items-center rounded-lg text-violet-bright hover:bg-surface-2"><IconExternal width={15} height={15} /></a>}
      </div>
    </div>
  );

  if (view === "list") {
    return (
      <div className="space-y-3">
        {err && <Notice tone="danger">{err}</Notice>}
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="border-b border-line text-faint">
              <tr>{["Opportunity", "Stage", "Status", "Found", "Approved", "Applied", "Interview", "Link"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {optimistic.map((it) => (
                <tr key={it.id} className="hover:bg-surface-2/60">
                  <td className="px-4 py-3"><Link href={`/opportunities/${it.id}`} className="font-medium hover:underline">{it.title}</Link>{it.is_sample && <span className="ml-2"><SampleBadge /></span>}<p className="text-faint">{it.company ?? it.publisher}</p></td>
                  <td className="px-4 py-3">
                    <select aria-label="Stage" className="field h-8 w-auto py-0 text-[12px]" value={columnOf(it) ?? ""} onChange={(e) => moveTo(it, e.target.value as Column)}>
                      {COLUMNS.map((c) => <option key={c} value={c}>{TITLES[c]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={it.status} /></td>
                  <td className="px-4 py-3 text-muted">{fmtDate(it.discovered_at)}</td>
                  <td className="px-4 py-3 text-muted">{fmtDate(it.approved_at)}</td>
                  <td className="px-4 py-3 text-muted">{fmtDate(it.applied_at)}</td>
                  <td className="px-4 py-3 text-muted">{fmtDate(it.interview_at)}</td>
                  <td className="px-4 py-3">{it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-violet-bright hover:underline">Open</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {err && <Notice tone="danger">{err}</Notice>}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 xl:mx-0 xl:grid xl:grid-cols-6 xl:overflow-visible xl:px-0">
        {COLUMNS.map((col) => {
          const list = optimistic.filter((i) => columnOf(i) === col);
          return (
            <section key={col} aria-label={TITLES[col]} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { const it = optimistic.find((i) => i.id === drag); if (it) moveTo(it, col); setDrag(null); }}
              className="flex w-[78vw] max-w-[300px] shrink-0 snap-start flex-col rounded-[14px] bg-surface/60 p-2.5 ring-1 ring-line sm:w-[280px] xl:w-auto xl:max-w-none">
              <header className="mb-2.5 flex items-center gap-2 px-1.5 pt-1">
                <span className={cx("size-2 rounded-full", ACCENT[col])} />
                <h2 className="text-[13px] font-semibold">{TITLES[col]}</h2>
                <span className="ml-auto text-[12px] tabular-nums text-faint">{list.length}</span>
              </header>
              <div className="flex min-h-24 flex-col gap-2">
                {list.map(renderCard)}
                {!list.length && <p className="px-2 py-6 text-center text-[12px] text-faint">{col === "approved" ? "Approve in Review & Approve" : "Drop here"}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
