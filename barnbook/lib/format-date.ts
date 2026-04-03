const medium: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

const mediumWithTime: Intl.DateTimeFormatOptions = {
  ...medium,
  hour: "numeric",
  minute: "2-digit",
};

/** e.g. "Mar 15, 2026" */
export function formatDateShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, medium);
}

/** e.g. "Mar 15, 2026, 3:45 PM" */
export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, mediumWithTime);
}
