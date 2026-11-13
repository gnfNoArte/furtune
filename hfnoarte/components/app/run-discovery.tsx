"use client";
import { useState, useTransition } from "react";
import { runDiscoveryNow } from "@/app/actions/opportunities";
import { Button } from "../ui";
import { IconSearch } from "../icons";
import { sourceName } from "@/lib/sources";

type Summary = Awaited<ReturnType<typeof runDiscoveryNow>>;

export function RunDiscoveryButton({ variant = "primary", size = "md" }: { variant?: "primary" | "secondary"; size?: "sm" | "md" }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<Summary | null>(null);
  return (
    <div className="relative">
      <Button variant={variant} size={size} disabled={pending} onClick={() => start(async () => setResult(await runDiscoveryNow()))}>
        <IconSearch width={16} height={16} /> {pending ? "Searching sources…" : "Search now"}
      </Button>
      {result && (
        <div role="status" className="absolute right-0 z-20 mt-2 w-[min(92vw,360px)] rounded-xl border border-line bg-surface-2 p-4 text-sm shadow-2xl">
          {result.error ? <p className="text-danger">{result.error}</p> : (
            <>
              <p className="font-medium">{result.newIds.length} new {result.newIds.length === 1 ? "opportunity" : "opportunities"} saved</p>
              <p className="mt-1 text-muted">{result.found} items read · {result.kept} relevant · {result.merged} merged into existing · {result.mode === "keyword" ? "keyword analysis" : result.mode === "ai" ? "AI analysis" : "AI + keyword analysis"}</p>
              <ul className="mt-3 space-y-1 text-[12.5px]">
                {result.sources.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className="text-muted">{sourceName(s.id)}</span>
                    <span className={s.status === "failed" ? "text-danger" : s.status === "limited" ? "text-stretch" : s.status === "skipped" ? "text-faint" : "text-strong"}>{s.status === "ok" ? `${s.found} read` : s.status === "limited" ? `${s.found} read · limited` : s.status === "skipped" ? "nothing to search" : "failed"}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button className="mt-3 text-xs text-faint hover:text-fg" onClick={() => setResult(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
