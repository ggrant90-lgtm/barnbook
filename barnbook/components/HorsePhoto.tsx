import { cn } from "@/lib/cn";

export type HorsePhotoProps = {
  name: string;
  photoUrl: string | null | undefined;
  className?: string;
  /** Square-ish frame; default aspect for cards */
  aspectClassName?: string;
  sizes?: string;
};

/**
 * Horse image with initial fallback. Uses plain `<img>` for Supabase Storage URLs.
 */
export function HorsePhoto({
  name,
  photoUrl,
  className,
  aspectClassName = "aspect-[4/3]",
}: HorsePhotoProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={cn("overflow-hidden bg-barn-dark/5", aspectClassName, className)}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-[8rem] w-full items-center justify-center font-serif text-5xl text-barn-dark/15 sm:text-6xl">
          {initial}
        </div>
      )}
    </div>
  );
}
