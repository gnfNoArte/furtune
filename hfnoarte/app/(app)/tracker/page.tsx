import Link from "next/link";
import { TrackerBoard, type TrackerItem } from "@/components/app/tracker-board";
import { EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { IconBoard, IconList } from "@/components/icons";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Tracker" };

export default async function Tracker({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const view = (await searchParams).view === "list" ? "list" : "board";
  const { supabase } = await requireUser();
  const { data } = await supabase.from("opportunities")
    .select("id, title, company, publisher, status, approved_at, discovered_at, applied_at, interview_at, follow_up_date, notes, match_score, match_band, is_sample, documents, opportunity_links(url)")
    .or("status.not.in.(new,expired),approved_at.not.is.null")
    .order("updated_at", { ascending: false }).limit(300);
  const items: TrackerItem[] = (data ?? []).map((o) => ({ ...o, url: (o.opportunity_links as { url: string | null }[])?.find((l) => l.url)?.url ?? null })) as TrackerItem[];
  const tab = (v: string, label: string, Icon: typeof IconBoard) => (
    <Link href={v === "board" ? "/tracker" : "/tracker?view=list"} aria-current={view === v ? "page" : undefined}
      className={cx("inline-flex h-9 items-center gap-2 rounded-lg px-3 text-[13px]", view === v ? "bg-surface-3 text-fg" : "text-muted hover:text-fg")}><Icon width={15} height={15} />{label}</Link>
  );
  return (
    <div>
      <PageHeader eyebrow="Tracker" title="Applications in motion"
        description="Move cards as things progress. Applied, Interview and Offer need your approval first — and hfNoArte only records what you tell it."
        actions={<div className="flex rounded-[10px] border border-line bg-surface p-0.5">{tab("board", "Board", IconBoard)}{tab("list", "List", IconList)}</div>} />
      {items.length ? <TrackerBoard items={items} view={view} /> : (
        <EmptyState icon={<IconBoard />} title="Nothing tracked yet" body="Save an opportunity, prepare and approve an application, and it appears here. Use the status menu on any opportunity to start tracking it."
          action={<LinkButton href="/opportunities" variant="primary">Find opportunities</LinkButton>} />
      )}
    </div>
  );
}
