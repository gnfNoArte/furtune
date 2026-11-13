"use client";
import { useState } from "react";
import { Button } from "../ui";
import { IconCheck, IconCopy } from "../icons";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" variant="ghost" type="button" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />} {done ? "Copied" : label}
    </Button>
  );
}
