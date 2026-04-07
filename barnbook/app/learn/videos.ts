export type Video = {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
};

/**
 * Add your YouTube videos here. The `youtubeId` is the part after
 * `v=` in a YouTube URL (e.g. https://youtube.com/watch?v=dQw4w9WgXcQ).
 *
 * Thumbnails are pulled automatically from YouTube.
 */
export const videos: Video[] = [
  // Example — replace with real videos:
  // {
  //   id: "getting-started",
  //   youtubeId: "dQw4w9WgXcQ",
  //   title: "Getting Started with BarnBook",
  //   description: "Set up your barn, add horses, and invite your team in under five minutes.",
  // },
];
