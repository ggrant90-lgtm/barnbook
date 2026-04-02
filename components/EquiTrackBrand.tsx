/** Serif + brass — use for "Equi-Track" wordmark only. */
export function EquiTrackBrand({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif font-semibold tracking-tight text-brass ${className}`}>
      Equi-Track
    </span>
  );
}
