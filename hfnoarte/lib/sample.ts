import type { RawOpportunity } from "./types";

// Clearly labelled sample opportunities, for trying the app before any real
// search has run. They have no links, are flagged is_sample in the database,
// and are shown with a SAMPLE badge everywhere. They are never notified.
const note = "SAMPLE DATA — this is not a real vacancy or post. It exists only so you can try hfNoArte.";

export const SAMPLE_OPPORTUNITIES: RawOpportunity[] = [
  {
    source: "sample", url: null, kind: "employment", access_method: "Sample data",
    title: "Webflow Designer (Sample)", company: "Sample Studio", publisher: "Sample Studio",
    location: "Remote", work_arrangement: "remote", employment_type: "full_time",
    description: `${note}\n\nWe're looking for a Webflow designer to design and build marketing pages from Figma, manage the Webflow CMS and create interactions. Responsive design and a strong eye for typography matter. 2+ years of experience.`,
  },
  {
    source: "sample", url: null, kind: "social", access_method: "Sample data",
    title: "Need someone to redesign our landing page in Framer (Sample)", publisher: "@sample_founder",
    description: `${note}\n\nAnyone know a good Framer designer? We need someone to redesign our landing page and set up a simple blog. Budget around $1,500, hoping to launch in three weeks. DM me with examples.`,
    salary_text: "$1,500", salary_min: 1500, salary_max: 1500, currency: "USD", work_arrangement: "remote",
  },
  {
    source: "sample", url: null, kind: "employment", access_method: "Sample data",
    title: "Senior Frontend Engineer (Sample)", company: "Sample Tech", publisher: "Sample Tech",
    location: "Remote", work_arrangement: "remote", employment_type: "full_time",
    description: `${note}\n\nBuild our web app with React, TypeScript and Next.js. 5+ years of frontend engineering, GraphQL and Node.js experience required. Familiarity with Figma is a plus.`,
  },
  {
    source: "sample", url: null, kind: "freelance", access_method: "Sample data",
    title: "Brand identity and logo for a coffee roaster (Sample)", publisher: "Sample Roasters",
    description: `${note}\n\nSeeking a freelance brand designer for a new logo, visual identity and packaging direction. Then a small Shopify store. Please send your portfolio.`,
    employment_type: "freelance",
  },
  {
    source: "sample", url: null, kind: "employment", access_method: "Sample data",
    title: "Product Designer, Web3 Wallet (Sample)", company: "Sample Chain", publisher: "Sample Chain",
    location: "Hybrid — Lisbon", work_arrangement: "hybrid", employment_type: "contract",
    description: `${note}\n\nDesign onboarding and payment flows for a crypto wallet. UI/UX, prototyping in Figma and a design system. Understanding of Web3 and stablecoins like USDT helps.`,
  },
];
