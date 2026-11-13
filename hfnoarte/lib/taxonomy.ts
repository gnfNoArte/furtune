// Skill clusters, related job titles and search phrases.
// Clusters map many ways of saying a thing onto one idea, so matching is
// based on meaning ("needs someone to build our site" ≈ web design) rather
// than one exact keyword.

export interface Cluster {
  id: string;
  label: string;
  /** Lower-case patterns, matched on word boundaries. */
  terms: string[];
  /** A cluster that is code-heavy is a gap unless the candidate has it. */
  codeHeavy?: boolean;
}

export const CLUSTERS: Cluster[] = [
  { id: "webflow", label: "Webflow", terms: ["webflow"] },
  { id: "framer", label: "Framer", terms: ["framer"] },
  { id: "shopify", label: "Shopify", terms: ["shopify"] },
  { id: "no_code", label: "No-code building", terms: ["no-code", "nocode", "no code", "low-code", "low code"] },
  {
    id: "web_design", label: "Website design",
    terms: [
      "web design", "web designer", "website design", "website designer", "landing page", "landing pages",
      "site redesign", "website redesign", "redesign our site", "redesign our website", "redesign my website",
      "build our site", "build our website", "build my website", "build a website", "new website",
      "website build", "marketing site", "marketing website", "web presence",
    ],
  },
  { id: "responsive", label: "Responsive design", terms: ["responsive", "mobile-first", "mobile first"] },
  { id: "cms", label: "CMS", terms: ["cms", "content management"] },
  { id: "figma", label: "Figma", terms: ["figma"] },
  {
    id: "ui_ux", label: "UI/UX design",
    terms: ["ui/ux", "ux/ui", "ui ux", "ui design", "ux design", "ui designer", "ux designer", "user interface", "user experience", "interaction design", "ux", "ui"],
  },
  { id: "product_design", label: "Product design", terms: ["product design", "product designer", "digital product"] },
  { id: "prototyping", label: "Wireframing & prototyping", terms: ["wireframe", "wireframes", "wireframing", "prototype", "prototypes", "prototyping"] },
  { id: "design_systems", label: "Design systems", terms: ["design system", "design systems", "component library"] },
  {
    id: "branding", label: "Brand identity",
    terms: ["brand identity", "branding", "visual identity", "logo", "logos", "logo design", "rebrand", "brand designer", "brand guidelines"],
  },
  { id: "typography", label: "Typography", terms: ["typography", "type design"] },
  { id: "visual_design", label: "Visual & digital design", terms: ["visual design", "visual designer", "graphic design", "graphic designer", "digital design", "digital designer"] },
  { id: "css", label: "CSS", terms: ["css"] },
  { id: "ecommerce", label: "Ecommerce", terms: ["ecommerce", "e-commerce", "online store", "online shop"] },
  { id: "web3", label: "Web3", terms: ["web3", "web 3", "crypto", "blockchain", "defi", "wallet", "nft", "dapp", "on-chain", "onchain"] },
  { id: "p2p_trading", label: "P2P crypto trading", terms: ["p2p", "binance", "usdt", "bitcoin", "btc"] },
  { id: "data_annotation", label: "Data annotation", terms: ["data annotation", "annotation", "annotator", "data labeling", "data labelling", "labeling", "labelling"] },
  { id: "ai_training", label: "AI training & evaluation", terms: ["ai training", "ai trainer", "rlhf", "model evaluation", "ai evaluation", "llm evaluation", "evaluate ai", "ai tutor"] },
  { id: "coding_contributor", label: "AI coding contribution", terms: ["coding contributor", "code contributor", "coding expert for ai", "code evaluation"] },

  // Technologies NOT in the candidate's verified profile. They only count as
  // matches if the candidate adds them to their own profile.
  { id: "react", label: "React", terms: ["react", "react.js", "reactjs"], codeHeavy: true },
  { id: "nextjs", label: "Next.js", terms: ["next.js", "nextjs"], codeHeavy: true },
  { id: "vue", label: "Vue/Angular/Svelte", terms: ["vue", "vue.js", "angular", "svelte"], codeHeavy: true },
  { id: "javascript", label: "JavaScript", terms: ["javascript", "js", "es6"], codeHeavy: true },
  { id: "typescript", label: "TypeScript", terms: ["typescript"], codeHeavy: true },
  { id: "backend", label: "Backend development", terms: ["backend", "back-end", "node.js", "nodejs", "express", "django", "laravel", "rails", "api development", "microservices"], codeHeavy: true },
  { id: "fullstack", label: "Full-stack development", terms: ["full stack", "full-stack", "fullstack"], codeHeavy: true },
  { id: "languages", label: "Programming languages", terms: ["python", "php", "ruby", "java", "golang", "c#", "c++", "rust", "kotlin", "swift"], codeHeavy: true },
  { id: "devops", label: "DevOps / cloud", terms: ["devops", "aws", "kubernetes", "docker", "terraform", "gcp", "azure"], codeHeavy: true },
  { id: "solidity", label: "Smart contracts", terms: ["solidity", "smart contract", "smart contracts"], codeHeavy: true },
  { id: "wordpress", label: "WordPress", terms: ["wordpress", "elementor"] },
  { id: "motion", label: "Motion / video", terms: ["after effects", "motion design", "motion graphics", "video editing", "3d", "blender"] },
];

const CLUSTER_BY_ID = new Map(CLUSTERS.map((c) => [c.id, c]));
export const clusterLabel = (id: string) => CLUSTER_BY_ID.get(id)?.label ?? id;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERNS = new Map(
  CLUSTERS.map((c) => [
    c.id,
    new RegExp(`(?:^|[^a-z0-9])(?:${c.terms.map(escape).join("|")})(?=$|[^a-z0-9])`, "i"),
  ]),
);

/** Cluster ids mentioned in a piece of text. */
export function clustersIn(text: string): Set<string> {
  const found = new Set<string>();
  const t = ` ${text.toLowerCase()} `;
  for (const [id, re] of PATTERNS) if (re.test(t)) found.add(id);
  return found;
}

export const CODE_HEAVY = new Set(CLUSTERS.filter((c) => c.codeHeavy).map((c) => c.id));

/** Titles worth searching for each discipline (query expansion). */
export const RELATED_TITLES: Record<string, string[]> = {
  "Web Design": ["Web Designer", "Website Designer", "Webflow Developer", "Webflow Designer", "No-Code Developer", "Framer Designer", "Framer Developer", "Digital Experience Designer", "Landing Page Designer", "Shopify Designer"],
  "Product Design": ["Product Designer", "Digital Product Designer", "UI/UX Designer", "UX Designer", "UI Designer", "Interaction Designer"],
  "Brand Identity Design": ["Brand Designer", "Brand Identity Designer", "Visual Designer", "Graphic Designer", "Logo Designer", "Digital Designer"],
  "Web3 Product Design": ["Web3 Designer", "Web3 Product Designer", "Crypto Product Designer"],
  "AI Training and Evaluation": ["Data Annotator", "AI Trainer", "AI Data Specialist", "Model Evaluator", "AI Training Contributor"],
};

export const DEFAULT_CATEGORIES = [
  "Product Design", "UI/UX Design", "Web Design", "Webflow Development", "Framer Development",
  "Digital Design", "Visual Design", "Brand Identity Design", "Relevant Frontend Design",
  "Web3 Product Design", "Relevant Web3 opportunities", "Data Annotation",
  "AI Training and Evaluation", "Relevant Coding Contributor opportunities",
];

/** Phrases people use on social platforms when they need this kind of work. */
export const SOCIAL_SEARCH_PHRASES = [
  "looking for a webflow developer", "need a webflow designer", "looking for a framer designer",
  "need someone to build our website", "looking for a web designer", "anyone know a good website designer",
  "need a landing page designer", "looking for a shopify designer", "need a brand designer",
  "looking for a product designer", "looking for a ui ux designer", "need a logo designer",
  "seeking a no-code developer", "redesign our landing page", "hiring a web3 designer",
];

/** Titles that signal a primarily engineering role. */
export const ENGINEERING_TITLE =
  /\b(software|backend|back-end|full[- ]?stack|front[- ]?end|devops|data|ml|machine learning|platform|mobile|ios|android|qa|site reliability|cloud)\s+(engineer|developer|dev)\b|\b(engineer|programmer)\b/i;

/** Titles that mean design/no-code web work even if they say "developer". */
export const NO_CODE_TITLE = /\b(webflow|framer|shopify|no[- ]?code|wix|squarespace)\b/i;
