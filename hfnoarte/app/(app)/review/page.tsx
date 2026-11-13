import { ReviewQueue, type ReviewItem } from "@/components/app/review-queue";
import { EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui";
import { IconCheckCircle } from "@/components/icons";
import { requireUser } from "@/lib/supabase/server";
import type { MatchResult } from "@/lib/types";

export const metadata = { title: "Review & Approve" };

export default async function Review({ searchParams }: { searchParams: Promise<{ approved?: string }> }) {
  const approvedCount = Number((await searchParams).approved ?? 0);
  const { supabase } = await requireUser();
  const { data: drafts } = await supabase.from("drafts").select("id, kind, title, content, review_state, generated_mode, warnings, approved_at, opportunity_id").eq("review_state", "pending_review").order("created_at");
  const ids = [...new Set((drafts ?? []).map((d) => d.opportunity_id))];
  const { data: opps } = ids.length
    ? await supabase.from("opportunities").select("id, title, company, publisher, kind, employment_type, match_score, match_band, is_sample, description, match, opportunity_links(url)").in("id", ids)
    : { data: [] as never[] };
  const items: ReviewItem[] = (opps ?? []).map((o) => ({
    id: o.id, title: o.title, company: o.company, publisher: o.publisher, kind: o.kind, employment_type: o.employment_type,
    match_score: o.match_score, match_band: o.match_band, is_sample: o.is_sample, description: o.description,
    url: (o.opportunity_links as { url: string | null }[])?.find((l) => l.url)?.url ?? null,
    reasons: (o.match as MatchResult | null)?.reasons ?? [], gaps: (o.match as MatchResult | null)?.gaps ?? [],
    drafts: (drafts ?? []).filter((d) => d.opportunity_id === o.id),
  })).sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));

  return (
    <div>
      <PageHeader eyebrow="Review & Approve" title="Nothing goes out without you"
        description="Every prepared application and message waits here. Approving means it's ready for you to use — hfNoArte never submits applications or sends messages itself." />
      {approvedCount > 0 && (
        <Notice tone="violet" className="mb-6" title={`${approvedCount} application${approvedCount === 1 ? "" : "s"} approved`}>
          Nothing has been submitted or sent. Open each one from the <a href="/tracker">Tracker</a>, use your approved material on the original page, then mark it as applied or contacted.
        </Notice>
      )}
      {items.length ? <ReviewQueue items={items} /> : (
        <EmptyState icon={<IconCheckCircle />} title="All caught up" body="Open an opportunity and choose “Prepare application” to draft a cover letter, answers, a comment or a DM. They'll appear here for review."
          action={<LinkButton href="/opportunities" variant="primary">Browse opportunities</LinkButton>} />
      )}
    </div>
  );
}
