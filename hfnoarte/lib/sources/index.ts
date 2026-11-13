import { adzuna } from "./adzuna";
import { arbeitnow } from "./arbeitnow";
import { bluesky } from "./bluesky";
import { companyBoards } from "./company-boards";
import { hackernews } from "./hackernews";
import { himalayas } from "./himalayas";
import { jobicy } from "./jobicy";
import { mastodon } from "./mastodon";
import { notIntegrated } from "./not-integrated";
import { reddit } from "./reddit";
import { remoteok } from "./remoteok";
import { remotive } from "./remotive";
import { threads } from "./threads";
import { weworkremotely } from "./weworkremotely";
import type { SourceAdapter } from "./types";

/** Every source. Add a new platform by writing an adapter and listing it here. */
export const SOURCES: SourceAdapter[] = [
  adzuna, remotive, remoteok, weworkremotely, arbeitnow, jobicy, himalayas, companyBoards,
  hackernews, reddit, bluesky, mastodon, threads,
  ...notIntegrated,
];

export const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));
export const sourceName = (id: string) =>
  id === "url" ? "Added by URL" : id === "manual" ? "Manual entry" : id === "sample" ? "Sample data" : SOURCE_BY_ID.get(id)?.name ?? id;

export type { SourceAdapter } from "./types";
