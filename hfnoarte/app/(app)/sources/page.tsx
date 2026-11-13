import { RunDiscoveryButton } from "@/components/app/run-discovery";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { kindLabel } from "@/components/app/badges";
import { relTime } from "@/lib/format";
import { SOURCES } from "@/lib/sources";
import { requireUser } from "@/lib/supabase/server";
import { aiAvailable, aiConfig } from "@/lib/ai/client";

export const metadata = { title: "Sources" };

type Run = { source: string; status: string; found: number; kept: number; message: string | null; queries: string[]; finished_at: string | null };

export default async function Sources() {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("source_runs").select("source, status, found, kept, message, queries, finished_at").order("started_at", { ascending: false }).limit(400);
  const runs = (data ?? []) as Run[];
  const latest = new Map<string, Run>();
  const lastOk = new Map<string, string>();
  for (const r of runs) {
    if (!latest.has(r.source)) latest.set(r.source, r);
    if ((r.status === "ok" || r.status === "limited") && r.finished_at && !lastOk.has(r.source)) lastOk.set(r.source, r.finished_at);
  }
  const groups = [
    { title: "Searched automatically", items: SOURCES.filter((s) => ["ready", "limited"].includes(s.availability().state)) },
    { title: "Needs a free key", items: SOURCES.filter((s) => s.availability().state === "not_configured") },
    { title: "Not integrated", items: SOURCES.filter((s) => s.availability().state === "not_integrated") },
  ];
  const ai = aiConfig();

  return (
    <div>
      <PageHeader eyebrow="Sources" title="What was searched, and how"
        description="hfNoArte only uses official APIs, public feeds and pages you paste. Platforms without a free, permitted way in are listed as not integrated — never silently skipped or faked."
        actions={<RunDiscoveryButton />} />

      <Card className="mb-8 flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="font-medium">Analysis</span>
        {aiAvailable() ? <Badge tone="butter">AI · {ai?.provider} · {ai?.model}</Badge> : <Badge tone="stretch">Keyword fallback — no AI key</Badge>}
        <span className="text-muted">AI checks intent and fit for the most promising items each run; everything else is scored by transparent rules.</span>
      </Card>

      <div className="space-y-10">
        {groups.map((g) => g.items.length > 0 && (
          <section key={g.title}>
            <SectionTitle>{g.title}</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              {g.items.map((s) => {
                const a = s.availability();
                const r = latest.get(s.id);
                const ok = lastOk.get(s.id);
                const stateBadge =
                  a.state === "not_integrated" ? <Badge>Not integrated</Badge>
                  : a.state === "not_configured" ? <Badge tone="stretch">Needs key</Badge>
                  : !r ? <Badge tone="info">Not run yet</Badge>
                  : r.status === "failed" ? <Badge tone="danger">Last search failed</Badge>
                  : r.status === "skipped" ? <Badge>Nothing to search</Badge>
                  : r.status === "limited" || a.state === "limited" ? <Badge tone="stretch">Limited access</Badge>
                  : <Badge tone="strong">Searched</Badge>;
                return (
                  <Card key={s.id} className="flex flex-col gap-3 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold tracking-tight">{s.name}</h3>
                      {stateBadge}
                      <span className="ml-auto text-[12px] text-faint">{s.kinds.map(kindLabel).join(" · ")}</span>
                    </div>
                    <p className="text-[13px] text-muted">{s.coverage}</p>
                    <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-[12.5px]">
                      <dt className="text-faint">Access</dt><dd>{s.access}</dd>
                      {a.state !== "not_integrated" && <><dt className="text-faint">Last success</dt><dd>{ok ? relTime(ok) : "Never"}</dd></>}
                      {r && <><dt className="text-faint">Last run</dt><dd>{r.found} read · {r.kept} kept{r.finished_at ? ` · ${relTime(r.finished_at)}` : ""}</dd></>}
                      {r?.message && <><dt className="text-faint">Note</dt><dd className={r.status === "failed" ? "text-danger" : "text-muted"}>{r.message}</dd></>}
                      {r && r.queries.length > 0 && <><dt className="text-faint">Searched for</dt><dd className="text-muted">{r.queries.slice(0, 6).join(" · ")}{r.queries.length > 6 ? ` +${r.queries.length - 6}` : ""}</dd></>}
                    </dl>
                    {"note" in a && a.state !== "not_integrated" && a.note && <p className="text-[12.5px] text-stretch">{a.note}</p>}
                    {a.state === "not_configured" && <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-muted">Setup: {a.setup}</p>}
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
