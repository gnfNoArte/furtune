export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "unknown date";
  const d = new Date(iso);
  const s = Math.round((now - +d) / 1000);
  if (s < 0) {
    const f = -s;
    if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))} min`;
    if (f < 86400) return `in ${Math.round(f / 3600)} h`;
    return `in ${Math.round(f / 86400)} d`;
  }
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

export const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const employmentLabel = (t: string | null | undefined) =>
  t ? ({ full_time: "Full-time", part_time: "Part-time", contract: "Contract", internship: "Internship", freelance: "Freelance", graduate: "Graduate" } as Record<string, string>)[t] ?? t : null;

export const arrangementLabel = (a: string | null | undefined) =>
  a ? ({ remote: "Remote", onsite: "On-site", hybrid: "Hybrid" } as Record<string, string>)[a] ?? a : null;
