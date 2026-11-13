import { describe, expect, it } from "vitest";
import { canonicalUrl, fingerprint, groupDuplicates } from "../lib/dedupe";
import { checkDraft } from "../lib/drafts/guard";
import { templateDrafts } from "../lib/drafts/generate";
import { buildPlan } from "../lib/discovery/plan";
import { NOARTE_SEED_PROFILE as P } from "../lib/candidate/seed";
import { DEFAULT_PREFERENCES } from "../lib/data";
import type { RawOpportunity } from "../lib/types";

const raw = (o: Partial<RawOpportunity>): RawOpportunity => ({ source: "a", url: null, kind: "employment", title: "", description: "", access_method: "x", ...o });

describe("dedupe", () => {
  it("normalises URLs", () => {
    expect(canonicalUrl("https://www.twitter.com/a/status/1?utm_source=x#top")).toBe("https://x.com/a/status/1");
  });
  it("merges the same vacancy from two boards", () => {
    const g = groupDuplicates([
      raw({ source: "remotive", title: "Webflow Designer (Remote)", company: "Acme Inc", url: "https://remotive.com/1" }),
      raw({ source: "jobicy", title: "Webflow designer", company: "ACME Inc.", url: "https://jobicy.com/9" }),
    ]);
    expect(g.size).toBe(1);
  });
  it("keeps two different short social posts apart", () => {
    const a = raw({ kind: "social", description: "Need a web designer", url: "https://bsky.app/1" });
    const b = raw({ kind: "social", description: "Need a web designer", url: "https://bsky.app/2" });
    expect(fingerprint(a)).not.toBe(fingerprint(b));
  });
});

describe("drafts", () => {
  it("flags 'we' — NoArte is one person", () => {
    expect(checkDraft("We build beautiful sites for our clients.", P).join(" ")).toMatch(/first person/);
  });
  it("flags technologies the candidate hasn't listed", () => {
    expect(checkDraft("I have built many React and TypeScript apps.", P).join(" ")).toMatch(/React/);
    expect(checkDraft("I design and build Webflow sites.", P)).toEqual([]);
  });
  it("templates use only real projects and never claim unverified tech", () => {
    const d = templateDrafts({ kind: "employment", title: "Webflow Designer", description: "Webflow, Figma, CMS", company: "Acme", publisher: "Acme" }, P);
    const letter = d.find((x) => x.kind === "cover_letter")!;
    expect(letter.content).toMatch(/Aksum Labs|FURTUNE|Leventis/);
    expect(letter.content).not.toMatch(/React|TypeScript|full-stack|\bwe\b|web designer/i);
    expect(letter.content).toMatch(/Olayemi/);
    expect(d.every((x) => x.warnings.length === 0)).toBe(true);
  });
  it("prepares comment, DM and proposal for social posts", () => {
    const d = templateDrafts({ kind: "social", title: "Need a Framer landing page", description: "Framer landing page redesign", company: null, publisher: "@founder" }, P);
    expect(d.map((x) => x.kind)).toEqual(expect.arrayContaining(["comment", "dm", "proposal", "portfolio_pick"]));
    expect(d.find((x) => x.kind === "dm")!.content).toMatch(/Hi founder/);
  });
  it("describes Rialo as an exploration, not client work", () => {
    const d = templateDrafts({ kind: "employment", title: "Web3 Product Designer", description: "wallet UX, web3, figma", company: "X", publisher: "X" }, P);
    expect(d.find((x) => x.kind === "cover_letter")!.content).toMatch(/Rialo \(an independent exploration/);
  });
});

describe("query plan", () => {
  it("searches many related titles, not one query", () => {
    const plan = buildPlan(P, { ...DEFAULT_PREFERENCES, target_titles: ["Webflow Developer"] });
    expect(plan.titles.length).toBeGreaterThan(5);
    expect(plan.titles).toEqual(expect.arrayContaining(["Web Designer", "Website Designer", "No-Code Developer"]));
    expect(plan.phrases.some((p) => /webflow/.test(p))).toBe(true);
  });
});

describe("draft honesty", () => {
  it("never cites a project as an example of a builder it didn't use", () => {
    const d = templateDrafts({ kind: "social", title: "Need a Framer landing page", description: "Framer site redesign", company: null, publisher: "@x" }, P);
    const comment = d.find((x) => x.kind === "comment")!.content;
    expect(comment).toMatch(/Framer sites/);
    expect(comment).not.toMatch(/MANKIND/); // MANKIND is a Shopify project
  });
  it("cites a matching project when there is one", () => {
    const d = templateDrafts({ kind: "social", title: "Looking for a Webflow developer", description: "Webflow site", company: null, publisher: "@x" }, P);
    expect(d.find((x) => x.kind === "comment")!.content).toMatch(/e\.g\. (Aksum Labs|FURTUNE|A\.G\. Leventis Museum)/);
  });
});
