import { Badge, cx } from "../ui";
import { BAND_LABELS } from "@/lib/matching/score";
import { INTENT_LABELS } from "@/lib/matching/intent";
import { sourceName } from "@/lib/sources";
import { STATUS_LABELS, type Credibility, type Intent, type MatchBand, type OpportunityStatus } from "@/lib/types";

const BAND_TONE = { strong: "strong", reasonable: "reasonable", stretch: "stretch", poor: "poor" } as const;
const BAND_COLOR: Record<MatchBand, string> = { strong: "#1B1A17", reasonable: "#6B4430", stretch: "#9A7424", poor: "#B7AD98" };

export function BandBadge({ band }: { band: MatchBand | null | undefined }) {
  if (!band) return <Badge>Not scored</Badge>;
  return <Badge tone={BAND_TONE[band]}>{BAND_LABELS[band]}</Badge>;
}

export function ScoreRing({ score, band, size = 48 }: { score: number | null; band: MatchBand | null; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  const color = band ? BAND_COLOR[band] : "#B7AD98";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Match score ${score ?? "unknown"} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E3DACA" strokeWidth="3.5" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[13px] font-semibold tabular-nums" style={{ fontSize: size > 56 ? 18 : 13 }}>{score ?? "–"}</span>
    </div>
  );
}

const STATUS_TONE: Partial<Record<OpportunityStatus, "butter" | "strong" | "danger" | "info" | "stretch" | "neutral">> = {
  new: "butter", interview: "info", won: "strong", rejected: "danger", expired: "neutral", applied: "info", contacted: "info", follow_up: "stretch",
};
export function StatusBadge({ status }: { status: OpportunityStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABELS[status]}</Badge>;
}

export function SourceBadge({ source }: { source: string }) {
  return <Badge>{sourceName(source)}</Badge>;
}

export function SampleBadge() {
  return <Badge tone="sample" title="Sample data — not a real opportunity">SAMPLE · NOT REAL</Badge>;
}

export function ModeBadge({ mode }: { mode: string | null | undefined }) {
  if (mode === "ai") return <Badge tone="butter" title="Analysed by AI, with app-side score caps">AI analysis</Badge>;
  return <Badge title="AI isn't configured or wasn't used for this item; scored by keyword rules">Keyword analysis</Badge>;
}

export function CredibilityBadge({ c }: { c: Credibility | null }) {
  if (!c) return null;
  const tone = { high: "strong", medium: "reasonable", low: "danger", unknown: "neutral" }[c.level] as "strong";
  const label = { high: "Credible", medium: "Looks genuine", low: "Check carefully", unknown: "Little info" }[c.level];
  return <Badge tone={tone} title="Credibility assessment — see evidence on the detail page">{label}</Badge>;
}

export function IntentBadge({ intent }: { intent: Intent | null }) {
  if (!intent || intent.label === "vacancy") return null;
  return <Badge tone="info">{INTENT_LABELS[intent.label]}</Badge>;
}

export const kindLabel = (k: string) => ({ employment: "Job", freelance: "Freelance", social: "Social post" }[k] ?? k);
export function KindBadge({ kind, employmentType }: { kind: string; employmentType?: string | null }) {
  const t = employmentType === "internship" ? "Internship" : kindLabel(kind);
  return <Badge className={cx(kind === "social" && "border-ink/25")}>{t}</Badge>;
}
