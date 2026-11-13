"use client";
import { useTransition } from "react";
import { clearSamples, loadSamples } from "@/app/actions/opportunities";
import { Button } from "../ui";

export function SampleButtons({ hasSamples }: { hasSamples: boolean }) {
  const [pending, start] = useTransition();
  return hasSamples
    ? <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { await clearSamples(); })}>Remove sample data</Button>
    : <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => { await loadSamples(); })}>Load sample data</Button>;
}
