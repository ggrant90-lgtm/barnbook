export type Video = {
  id: string;
  title: string;
  description: string;
} & (
  | { source: "youtube"; youtubeId: string; loomId?: never }
  | { source: "loom"; loomId: string; youtubeId?: never }
);

/**
 * Add your videos here.
 *
 * YouTube — youtubeId is the part after `v=` in a YouTube URL.
 * Loom   — loomId is the part after `/share/` in a Loom URL.
 */
export const videos: Video[] = [
  {
    id: "quick-intro",
    source: "loom",
    loomId: "a43fda2dbbfc46319da402f2e225aa6f",
    title: "Quick Intro",
    description: "A quick walkthrough of BarnBook and what it can do for your barn.",
  },
];
