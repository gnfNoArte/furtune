import { describe, expect, it } from "vitest";
import { NOARTE_SEED_PROFILE as P } from "../lib/candidate/seed";
import { candidateClusters, candidateLevel } from "../lib/candidate/clusters";
import { DEFAULT_PREFERENCES } from "../lib/data";
import { scoreOpportunity } from "../lib/matching/score";
import { detectIntent } from "../lib/matching/intent";
import { assessCredibility } from "../lib/matching/credibility";
import { SAMPLE_OPPORTUNITIES } from "../lib/sample";
import type { RawOpportunity } from "../lib/types";

const prefs = { ...DEFAULT_PREFERENCES, work_arrangements: ["remote" as const] };
const now = new Date("2026-11-13T00:00:00Z");
const job = (o: Partial<RawOpportunity>): RawOpportunity => ({ source: "test", url: null, kind: "employment", title: "", description: "", access_method: "test", ...o });

describe("candidate profile", () => {
  it("recognises the candidate's real skill areas only", () => {
    const c = candidateClusters(P);
    for (const id of ["webflow", "framer", "shopify", "figma", "ui_ux", "product_design", "branding", "web3", "data_annotation", "web_design", "css"]) expect(c.has(id), id).toBe(true);
    for (const id of ["react", "nextjs", "javascript", "typescript", "backend", "fullstack"]) expect(c.has(id), id).toBe(false);
  });
  it("estimates level from the given dates and labels it as an estimate", () => {
    const l = candidateLevel(P, now);
    expect(l.source).toBe("estimated");
    expect(l.years).toBeCloseTo(4.7, 0);
    expect(l.level).toBe("mid");
  });
});

describe("scoring", () => {
  it("rates a Webflow design role as a strong match with reasons from real projects", () => {
    const r = scoreOpportunity(job({ title: "Webflow Designer", description: "Design and build marketing pages from Figma in Webflow, manage the CMS, responsive design.", work_arrangement: "remote", employment_type: "full_time" }), P, prefs, { now });
    expect(r.band).toBe("strong");
    expect(r.reasons.join(" ")).toMatch(/Aksum Labs|FURTUNE|Leventis/);
  });

  it("does not let keyword overlap carry an engineering role", () => {
    const r = scoreOpportunity(job({ title: "Senior Frontend Engineer", description: "React, TypeScript, Next.js, Node.js. Figma and Webflow familiarity a plus. 5+ years.", work_arrangement: "remote", employment_type: "full_time" }), P, prefs, { now });
    expect(r.score).toBeLessThanOrEqual(49);
    expect(["stretch", "poor"]).toContain(r.band);
    expect(r.gaps.join(" ")).toMatch(/React/);
    expect(r.caps.join(" ")).toMatch(/Engineering-focused/);
  });

  it("treats a 'Webflow Developer' as no-code work, not engineering", () => {
    const r = scoreOpportunity(job({ title: "Webflow Developer", description: "Build sites in Webflow from Figma designs. Some CSS.", work_arrangement: "remote" }), P, prefs, { now });
    expect(r.caps.join(" ")).not.toMatch(/Engineering/);
    expect(r.score).toBeGreaterThanOrEqual(65);
  });

  it("caps roles outside the candidate's disciplines even with skill mentions", () => {
    const r = scoreOpportunity(job({ title: "Account Manager", description: "Manage clients. Our team uses Figma and Webflow.", work_arrangement: "remote", employment_type: "full_time" }), P, prefs, { now });
    expect(r.score).toBeLessThanOrEqual(64);
  });

  it("gives a poor score to unrelated work", () => {
    const r = scoreOpportunity(job({ title: "Warehouse Operative", description: "Forklift licence required.", location: "Leeds", work_arrangement: "onsite" }), P, prefs, { now });
    expect(r.band).toBe("poor");
  });

  it("flags years-of-experience gaps honestly", () => {
    const r = scoreOpportunity(job({ title: "Product Designer", description: "8+ years of product design experience, Figma, design systems.", work_arrangement: "remote" }), P, prefs, { now });
    expect(r.gaps.join(" ")).toMatch(/8\+ years/);
  });

  it("scores every sample sensibly", () => {
    const bands = SAMPLE_OPPORTUNITIES.map((s) => scoreOpportunity(s, P, prefs, { now }).band);
    expect(bands[0]).toBe("strong");            // Webflow designer
    expect(["strong", "reasonable"]).toContain(bands[1]); // Framer landing page
    expect(["stretch", "poor"]).toContain(bands[2]);      // React engineer
  });
});

describe("intent", () => {
  it.each([
    "Looking for a Webflow developer for our startup site",
    "Need someone to build our website, budget $2k",
    "Anyone know a good website designer? Need a landing page redesign",
    "Seeking a no-code developer who knows Framer",
  ])("detects a hiring intent: %s", (t) => {
    expect(["hiring_request", "recommendation_request"]).toContain(detectIntent(t).label);
  });
  it.each([
    "I'm available for new Webflow projects, DM me for a quote",
    "[For Hire] Webflow designer with 5 years experience, check out my portfolio",
    "We build websites for startups — slots open this month",
  ])("recognises self-promotion: %s", (t) => {
    expect(detectIntent(t).label).toBe("self_promotion");
  });
  it("ignores posts with no relevant work", () => {
    expect(detectIntent("Looking for a roommate in Lagos").label).toBe("not_relevant");
  });
});

describe("credibility", () => {
  it("doesn't penalise a small new account with a specific brief", () => {
    const c = assessCredibility(job({ kind: "social", title: "Need a Framer site", description: "Need a 5-page Framer site with a CMS blog, budget $1,500, deadline in 3 weeks. DM me.", author_meta: { followers: 12, account_created_at: "2026-11-01T00:00:00Z" } }), { now });
    expect(c.level).not.toBe("low");
    expect(c.evidence.some((e) => e.signal === "Specific details" && e.effect === "positive")).toBe(true);
  });
  it("flags scam patterns with evidence", () => {
    const c = assessCredibility(job({ kind: "social", title: "Easy design job", description: "Pay a registration fee to apply. Contact on WhatsApp only +2348000000000" }), { now });
    expect(c.level).toBe("low");
    expect(c.evidence.filter((e) => e.effect === "negative").length).toBeGreaterThan(0);
  });
});
