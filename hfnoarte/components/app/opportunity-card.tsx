import Link from "next/link";
import { BandBadge, CredibilityBadge, IntentBadge, KindBadge, ModeBadge, SampleBadge, ScoreRing, SourceBadge, StatusBadge } from "./badges";
import { IconExternal } from "../icons";
import { arrangementLabel, employmentLabel, relTime } from "@/lib/format";
import type { Credibility, Intent, MatchResult, OpportunityStatus } from "@/lib/types";

export interface OpportunityListItem {
  id: string; title: string; company: string | null; publisher: string | null; location: string | null;
  work_arrangement: string | null; employment_type: string | null; salary_text: string | null; kind: string;
  published_at: string | null; discovered_at: string; match: MatchResult | null; match_score: number | null; match_band: MatchResult["band"] | null;
  credibility: Credibility | null; intent: Intent | null; status: OpportunityStatus; is_sample: boolean; is_active: boolean | null;
  analysis_mode: string | null; opportunity_links?: { source: string; url: string | null }[];
}

export const OPPORTUNITY_LIST_COLUMNS =
  "id, title, company, publisher, location, work_arrangement, employment_type, salary_text, kind, published_at, discovered_at, match, match_score, match_band, credibility, intent, status, is_sample, is_active, analysis_mode, opportunity_links(source, url)";

export function OpportunityCard({ o, compact = false }: { o: OpportunityListItem; compact?: boolean }) {
  const link = o.opportunity_links?.find((l) => l.url);
  const sources = [...new Set((o.opportunity_links ?? []).map((l) => l.source))];
  const arr = arrangementLabel(o.work_arrangement);
  const meta = [o.company ?? o.publisher, o.location, arr && !o.location?.toLowerCase().includes(arr.toLowerCase()) ? arr : null, employmentLabel(o.employment_type), o.salary_text].filter(Boolean);
  return (
    <article className={`card group relative p-4 transition-colors hover:border-line-strong sm:p-5 ${o.is_sample ? "border-stretch/30" : ""}`}>
      <div className="flex gap-4">
        <ScoreRing score={o.match_score} band={o.match_band} size={compact ? 44 : 52} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {o.is_sample && <SampleBadge />}
            <BandBadge band={o.match_band} />
            <KindBadge kind={o.kind} employmentType={o.employment_type} />
            <IntentBadge intent={o.intent} />
            {!compact && <CredibilityBadge c={o.credibility} />}
            {o.status !== "new" && <StatusBadge status={o.status} />}
            {o.is_active === false && <span className="text-[11.5px] text-stretch">May be closed</span>}
          </div>
          <h3 className="mt-2 text-[15.5px] font-semibold leading-snug tracking-tight">
            <Link href={`/opportunities/${o.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">{o.title}</Link>
          </h3>
          {meta.length > 0 && <p className="mt-1 truncate text-[13px] text-muted">{meta.join(" · ")}</p>}
          {!compact && o.match && (
            <div className="mt-3 grid gap-1.5 text-[13px] sm:grid-cols-2 sm:gap-4">
              <p className="text-muted"><span className="text-strong">Why · </span>{o.match.reasons[0] ?? o.match.experience_fit}</p>
              {o.match.gaps.length > 0 && <p className="text-muted"><span className="text-stretch">Gaps · </span>{o.match.gaps.slice(0, 2).join(" ")}</p>}
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-faint">
            {sources.map((s) => <SourceBadge key={s} source={s} />)}
            <span>Posted {o.published_at ? relTime(o.published_at) : "date not given"}</span>
            <span>Found {relTime(o.discovered_at)}</span>
            {!compact && <ModeBadge mode={o.analysis_mode} />}
            {link?.url && (
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="relative z-10 ml-auto inline-flex items-center gap-1 text-violet-bright hover:underline">
                Original <IconExternal width={14} height={14} />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
