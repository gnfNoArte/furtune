import type { CandidateProfile } from "../types";

/**
 * Olayemi's (NoArte's) starting profile, exactly as provided by the candidate
 * and the NoArte brand system.
 * Nothing here is inferred: no extra technologies, years, results or titles.
 * The uploaded resume replaces this, and every field can be edited.
 */
export const NOARTE_SEED_PROFILE: CandidateProfile = {
  full_name: "Olayemi",
  headline: "Digital Builder · brands, websites, interfaces",
  summary:
    "I design and build digital experiences that feel right: websites in Webflow, Framer and Shopify, brand identities, and UI/UX for products and apps. Based in Lagos, Nigeria, working with clients everywhere. Freelance since March 2022, with product design, AI data annotation and coding-contributor work alongside.",
  experience_level: null,
  skills: [
    { name: "Webflow", category: "Website design & development", evidence: "Aksum Labs, FURTUNE, A.G. Leventis Museum" },
    { name: "Webflow CMS & interactions", category: "Website design & development", evidence: "Webflow projects" },
    { name: "Figma-to-Webflow implementation", category: "Website design & development" },
    { name: "Framer", category: "Website design & development" },
    { name: "Shopify", category: "Website design & development", evidence: "MANKIND ecommerce website" },
    { name: "Responsive web design", category: "Website design & development" },
    { name: "Website structure & development", category: "Website design & development" },
    { name: "UI/UX design", category: "Product & interface design", evidence: "COLOR, MANKIND, FURTUNE" },
    { name: "Product design", category: "Product & interface design", evidence: "COLOR (color.app, colorvenues.app)" },
    { name: "Figma", category: "Product & interface design" },
    { name: "Interface design", category: "Product & interface design" },
    { name: "Wireframing & prototyping", category: "Product & interface design" },
    { name: "Design systems", category: "Product & interface design" },
    { name: "User experience thinking", category: "Product & interface design" },
    { name: "Brand identity design", category: "Branding & visual design", evidence: "MANKIND, FURTUNE" },
    { name: "Logo design", category: "Branding & visual design", evidence: "MANKIND, FURTUNE" },
    { name: "Visual identity systems", category: "Branding & visual design" },
    { name: "Typography & visual direction", category: "Branding & visual design" },
    // From the NoArte brand system: frontend work on real client projects — growing, never the headline.
    { name: "HTML", category: "Frontend development (growing, secondary)", evidence: "Real client work" },
    { name: "CSS", category: "Frontend development (growing, secondary)", evidence: "Real client work" },
    { name: "JavaScript", category: "Frontend development (growing, secondary)", evidence: "Real client work" },
    { name: "Shopify Liquid", category: "Frontend development (growing, secondary)", evidence: "Real client work" },
    { name: "P2P cryptocurrency trading (Bitcoin, USDT)", category: "Web3" },
    { name: "Binance P2P", category: "Web3" },
    { name: "Web3 ecosystem knowledge", category: "Web3" },
    { name: "Web3 product design", category: "Web3", evidence: "Rialo (independent exploration)" },
    { name: "Data annotation", category: "AI-related work", evidence: "Outlier — Aether project" },
    { name: "AI training & evaluation workflows", category: "AI-related work", evidence: "Outlier, Handshake AI" },
    { name: "Coding contribution (AI projects)", category: "AI-related work", evidence: "Handshake AI — Helix project" },
  ],
  experiences: [
    {
      title: "Freelance Digital Designer / Developer", organization: "Independent", kind: "freelance",
      start: "2022-03", end: null,
      description: "Independent client work across website design, development, UI/UX and branding.",
    },
    {
      title: "Lead Product Designer (UI/UX)", organization: "COLOR", kind: "employment",
      start: "2025-09", end: "2026-02",
      description: "Product design for color.app and colorvenues.app.",
    },
    {
      title: "Data Annotator — Aether Project", organization: "Outlier", kind: "contract",
      start: "2026-01", end: "2026-08",
    },
    {
      title: "Coding Contributor — Helix Project", organization: "Handshake AI", kind: "contract",
      start: "2026-04", end: "2026-06",
    },
  ],
  projects: [
    {
      name: "MANKIND", kind: "client",
      roles: ["Brand identity", "Logo design", "UI/UX", "Shopify ecommerce development"],
      skills: ["Brand identity design", "Logo design", "UI/UX design", "Shopify"],
    },
    {
      name: "Aksum Labs", kind: "client",
      roles: ["Website design", "Webflow development"],
      skills: ["Webflow", "Web design"],
      description: "Website for an AI consulting business.",
    },
    {
      name: "FURTUNE", kind: "personal",
      roles: ["Brand identity", "Logo design", "Ecommerce UI/UX", "Webflow development"],
      skills: ["Brand identity design", "Logo design", "UI/UX design", "Webflow"],
      url: "https://furtune.webflow.io",
      description: "Online furniture store built as a portfolio project.",
    },
    {
      name: "A.G. Leventis Museum", kind: "client",
      roles: ["Website design", "Webflow development"],
      skills: ["Webflow", "Web design"],
    },
    {
      name: "Rialo", kind: "exploration",
      roles: ["Web3 product design"],
      skills: ["Web3 product design", "UI/UX design"],
      description: "Independent exploration of wallet experiences and reducing friction between Web2 and Web3.",
    },
  ],
  education: [],
  suggested_titles: [
    "Product Designer", "UI/UX Designer", "Web Designer", "Webflow Developer", "Framer Developer",
    "Digital Designer", "Visual Designer", "Brand Identity Designer", "Web3 Product Designer",
    "Data Annotator", "AI Trainer",
  ],
  portfolio_url: null,
  writing_style: "Confident, warm, direct, a little playful. Short sentences. First person \"I\", never \"we\". Concrete, no buzzwords.",
  origin: "seed",
};
