// Ground rules sent with every AI request about the candidate.
export const HONESTY_RULES = `Rules you must follow:
- Use ONLY facts present in the candidate profile provided. Never invent employers, dates, years of experience, metrics, results, clients, certifications or qualifications.
- Never claim skills or technologies that are not in the profile. In particular do not claim React, Next.js, JavaScript, TypeScript, backend, full-stack or software-engineering experience unless the profile lists them.
- Keep employment, freelance client work, personal projects and independent explorations distinct. Describe each project with its correct kind (e.g. Rialo is an independent exploration, not client work).
- If something is unknown, say it is unknown rather than guessing.`;

export const profileForPrompt = (p: unknown) => JSON.stringify(p, null, 1).slice(0, 12_000);
