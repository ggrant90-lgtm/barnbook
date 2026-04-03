/** Public site base for invite copy (falls back to product domain). */
export function getPublicSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://barnbook.us";
}

export function getJoinUrl(): string {
  return `${getPublicSiteUrl()}/join`;
}
