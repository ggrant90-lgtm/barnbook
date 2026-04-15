export type Video = {
  id: string;
  title: string;
  description: string;
} & (
  | { source: "youtube"; youtubeId: string; loomId?: never; localSrc?: never }
  | { source: "loom"; loomId: string; youtubeId?: never; localSrc?: never }
  | { source: "local"; localSrc: string; youtubeId?: never; loomId?: never }
);

/**
 * Add your videos here.
 *
 * YouTube — youtubeId is the part after `v=` in a YouTube URL.
 * Loom   — loomId is the part after `/share/` in a Loom URL.
 * Local  — localSrc is the path relative to /public (e.g. "/videos/my-video.mp4").
 */
export const videos: Video[] = [
  {
    id: "quick-intro",
    source: "loom",
    loomId: "a43fda2dbbfc46319da402f2e225aa6f",
    title: "Quick Intro",
    description: "A quick walkthrough of BarnBook and what it can do for your barn.",
  },
  {
    id: "benefits-multiple-barns",
    source: "local",
    localSrc: "/videos/benefits-multiple-barns.mp4",
    title: "Benefits of Multiple Barns for Horses",
    description: "Learn why managing multiple barns can benefit your horses and your operation.",
  },
];
