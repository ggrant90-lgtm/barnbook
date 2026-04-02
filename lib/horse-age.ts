/** Human-readable age from foal date (YYYY-MM-DD). */
export function ageFromFoalDate(foalDate: string | null): string {
  if (!foalDate) return "—";
  const birth = new Date(foalDate + "T12:00:00");
  if (Number.isNaN(birth.getTime())) return "—";
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  if (years < 0) return "—";
  if (years === 0) {
    let months =
      (now.getFullYear() - birth.getFullYear()) * 12 +
      (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months -= 1;
    months = Math.max(0, months);
    return months === 0 ? "< 1 mo" : `${months} mo`;
  }
  return `${years} yr`;
}
