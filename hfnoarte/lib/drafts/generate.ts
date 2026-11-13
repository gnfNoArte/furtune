// Prepare application material and outgoing messages. Every draft lands in
// the Review & Approve queue — nothing is ever sent or submitted from here.
import "server-only";
import { chatJson } from "../ai/client";
import { HONESTY_RULES, profileForPrompt } from "../ai/rules";
import { candidateClusters, evidenceFor } from "../candidate/clusters";
import { clusterLabel, clustersIn } from "../taxonomy";
import { DRAFT_LABELS, type CandidateProfile, type DraftKind, type OpportunityKind } from "../types";
import { checkDraft } from "./guard";

export interface OpportunityForDraft {
  kind: OpportunityKind;
  title: string;
  description: string | null;
  company: string | null;
  publisher: string | null;
}

export interface PreparedDraft { kind: DraftKind; title: string; content: string; mode: "ai" | "template"; warnings: string[] }

export const kindsFor = (k: OpportunityKind): DraftKind[] =>
  k === "employment"
    ? ["cover_letter", "intro", "qa", "experience_summary"]
    : ["comment", "dm", "proposal", "portfolio_pick", "intro"];

function relevantProjects(o: OpportunityForDraft, p: CandidateProfile) {
  const wanted = clustersIn(`${o.title} ${o.description ?? ""}`);
  const have = candidateClusters(p);
  const overlap = [...wanted].filter((c) => have.has(c));
  const scored = p.projects.map((pr) => {
    const pc = clustersIn([...pr.skills, ...pr.roles].join(" "));
    const hits = overlap.filter((c) => pc.has(c) || ((c === "web_design" || c === "no_code") && (pc.has("webflow") || pc.has("framer") || pc.has("shopify"))));
    return { pr, hits };
  }).filter((x) => x.hits.length).sort((a, b) => b.hits.length - a.hits.length);
  return { overlap, projects: scored.map((s) => s.pr) };
}

const projectLine = (pr: CandidateProfile["projects"][number]) => {
  const kind = pr.kind === "exploration" ? "an independent exploration" : pr.kind === "personal" ? "a personal project" : pr.kind === "client" ? "client work" : "work";
  return `${pr.name} (${kind}: ${pr.roles.join(", ")})`;
};

/** Plain, honest templates built only from profile facts — used when AI is off. */
export function templateDrafts(o: OpportunityForDraft, p: CandidateProfile): PreparedDraft[] {
  const { overlap, projects } = relevantProjects(o, p);
  const skills = overlap.map(clusterLabel);
  const name = p.full_name || "";
  const who = o.publisher || o.company || "there";
  const greet = o.kind === "employment" ? `Dear ${o.company ? `${o.company} team` : "Hiring Manager"},` : `Hi ${who.replace(/^@/, "").split(" (")[0]},`;
  const projList = projects.slice(0, 3).map(projectLine);
  const skillText = skills.length ? skills.slice(0, 4).join(", ") : "design and website work";
  const current = p.experiences.find((e) => !e.end);
  const latest = p.experiences.filter((e) => e.kind === "employment")[0];
  const portfolio = p.portfolio_url ? `\n\nPortfolio: ${p.portfolio_url}` : "";
  // Only cite a project as an example of a builder if that project used it.
  const builders = skills.filter((s) => /webflow|framer|shopify/i.test(s));
  const builderExample = projects.find((pr) => builders.some((b) => [...pr.skills, ...pr.roles].join(" ").toLowerCase().includes(b.toLowerCase())));
  const shortTitle = o.title.replace(/\s*\(sample\)\s*$/i, "").slice(0, 90);

  const texts: Partial<Record<DraftKind, string>> = {
    cover_letter: [
      greet, "",
      `I'm applying for the ${o.title} role${o.company ? ` at ${o.company}` : ""}. My work covers ${skillText}${current ? `, and I've worked as a ${current.title.toLowerCase()} since ${current.start?.slice(0, 4)}` : ""}.`,
      "",
      projList.length ? `Relevant work includes ${projList.join("; ")}.` : "",
      latest ? `Most recently I was ${latest.title} at ${latest.organization}${latest.description ? `, where I ${latest.description.charAt(0).toLowerCase()}${latest.description.slice(1).replace(/\.$/, "")}` : ""}.` : "",
      "",
      "I'd welcome the chance to talk about how I could help.", "", "Kind regards,", name,
    ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n") + portfolio,
    intro: `I'm ${name ? `${name}, ` : ""}${p.headline ? p.headline.charAt(0).toLowerCase() + p.headline.slice(1) : "a designer and website builder"}. ${projList[0] ? `Relevant example: ${projList[0]}.` : ""}`.trim() + portfolio,
    qa: [
      `Why are you interested in this role?\n→ [Your own words — e.g. what draws you to ${o.company ?? "this team"}.] It lines up with my work in ${skillText}.`,
      `Describe relevant experience.\n→ ${projList.length ? projList.join("; ") : "See profile."}`,
      `What tools do you use?\n→ ${p.skills.filter((s) => /webflow|framer|figma|shopify/i.test(s.name)).map((s) => s.name).join(", ") || "See profile."}`,
      "Availability / notice period?\n→ [Fill in.]",
      "Salary expectations?\n→ [Fill in.]",
    ].join("\n\n"),
    experience_summary: [
      ...p.experiences.map((e) => `• ${e.title}, ${e.organization} (${e.start ?? "?"} – ${e.end ?? "present"}) — ${e.kind}`),
      ...projects.slice(0, 4).map((pr) => `• ${projectLine(pr)}`),
    ].join("\n"),
    comment: `I'd be glad to help with this — I design and build ${builders.length ? `${builders.join(" / ")} sites` : "websites and brands"}${builderExample ? `, e.g. ${builderExample.name}` : ""}. Sending you a DM.`,
    dm: [
      greet, "",
      `Saw your post ("${shortTitle}"). I work on ${skillText}${projList.length ? ` — relevant examples: ${projList.slice(0, 2).join("; ")}` : ""}.`,
      "Happy to share examples and talk through scope, timeline and budget.", "", name,
    ].join("\n") + portfolio,
    proposal: [
      greet, "",
      `Here's how I'd approach "${shortTitle}":`,
      "1. Short call to confirm goals, pages and content.",
      `2. Design in Figma${skills.some((s) => /webflow|framer|shopify/i.test(s)) ? ` and build in ${skills.filter((s) => /webflow|framer|shopify/i.test(s)).join(" / ")}` : ""}.`,
      "3. Review rounds, then launch and handover.",
      "",
      projList.length ? `Relevant work: ${projList.join("; ")}.` : "",
      "Timeline and price: [fill in after the call].", "", name,
    ].join("\n") + portfolio,
    portfolio_pick: projects.length
      ? `Show these first:\n${projects.slice(0, 3).map((pr) => `• ${pr.name} — matches ${overlap.filter((c) => evidenceFor(p, c).includes(pr.name)).map(clusterLabel).join(", ") || "the brief"}${pr.url ? ` (${pr.url})` : ""}`).join("\n")}`
      : "No project in your profile clearly matches this brief. Pick the closest one, or add projects to your profile.",
  };
  return kindsFor(o.kind).map((k) => {
    const content = (texts[k] ?? "").trim();
    return { kind: k, title: DRAFT_LABELS[k], content, mode: "template", warnings: checkDraft(content, p) };
  });
}

export async function aiDrafts(o: OpportunityForDraft, p: CandidateProfile): Promise<PreparedDraft[]> {
  const kinds = kindsFor(o.kind);
  const { projects } = relevantProjects(o, p);
  const system = `You prepare application material for one real candidate. Write like a thoughtful person, not a template: specific, warm, concise, no clichés ("I am thrilled", "passionate", "synergy", "leverage", "delve"), no exclamation marks, no emojis.
${HONESTY_RULES}
- Mention the most relevant projects by name with their correct kind. Leave a clearly marked [placeholder] for anything you don't know (availability, rates, motivation specifics).
- Public comments: 1–2 sentences, no hard selling, never include personal contact details.
- Direct messages: under 90 words.
- Cover letter: under 250 words.
- qa: answers to 4–5 common application questions, each as "Question\\n→ Answer".
- portfolio_pick: which 1–3 of the candidate's projects to show and why.
Return JSON: {"drafts":[{"kind": one of ${kinds.map((k) => `"${k}"`).join(", ")}, "content": string}]} with exactly one entry per kind.`;
  const user = `CANDIDATE PROFILE:\n${profileForPrompt(p)}\n\nMOST RELEVANT PROJECTS: ${projects.map((x) => x.name).join(", ") || "none clearly relevant"}\n\nOPPORTUNITY (${o.kind}):\nTitle: ${o.title}\nCompany: ${o.company ?? "unknown"}\nPosted by: ${o.publisher ?? "unknown"}\n\n${(o.description ?? "").slice(0, 5000)}`;
  const out = await chatJson<{ drafts: { kind: DraftKind; content: string }[] }>(system, user, { maxTokens: 3000, temperature: 0.5 });
  const byKind = new Map((out.drafts ?? []).filter((d) => d?.content).map((d) => [d.kind, d.content.trim()]));
  const fallback = templateDrafts(o, p);
  return kinds.map((k) => {
    const content = byKind.get(k);
    if (!content) return fallback.find((f) => f.kind === k)!;
    return { kind: k, title: DRAFT_LABELS[k], content, mode: "ai", warnings: checkDraft(content, p) };
  });
}
