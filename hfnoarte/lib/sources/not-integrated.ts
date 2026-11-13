import type { SourceAdapter } from "./types";

// Platforms with no free, permitted way to search public posts. They are
// listed so the candidate can see they were NOT searched, and why.
const unavailable = (id: string, name: string, note: string, kinds: SourceAdapter["kinds"]): SourceAdapter => ({
  id, name, kinds, access: "Not integrated", coverage: note,
  availability: () => ({ state: "not_integrated", note }),
});

export const notIntegrated: SourceAdapter[] = [
  unavailable("x", "X (Twitter)", "Searching posts through X's API requires a paid plan, and scraping breaks X's terms. Paste any X post link into \"Add by URL\" to analyse it.", ["social", "freelance"]),
  unavailable("linkedin", "LinkedIn", "LinkedIn has no public search API for jobs or posts, and its terms forbid scraping. Paste LinkedIn job or post links into \"Add by URL\" (pages behind login are entered manually).", ["employment", "social"]),
  unavailable("instagram", "Instagram", "Instagram's API can't search other people's posts or comments; hashtag search needs a business account and Meta review, and returns no account details. Paste post links into \"Add by URL\".", ["social"]),
  unavailable("upwork", "Upwork / Contra / Fiverr", "These marketplaces don't offer a free public API for job listings (Upwork's RSS feeds were retired). Paste listing links into \"Add by URL\".", ["freelance"]),
];
