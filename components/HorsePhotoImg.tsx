/**
 * User-uploaded horse photos (Supabase public URLs). Plain <img> avoids Next/Image
 * remotePatterns mismatches when env or project ref differs between build and DB.
 */
export function HorsePhotoImg({
  src,
  alt,
  className,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
    />
  );
}
