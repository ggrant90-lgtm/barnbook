import { supabase } from "@/lib/supabase";

// Reuse the existing horse-photos bucket — it's already provisioned.
// Store under barn-logos/{barn_id}/logo.{ext} for clarity.
const BUCKET = "horse-photos";

export function isAllowedLogoImage(file: File): boolean {
  return ["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type);
}

/**
 * Upload a barn's invoice logo. Returns the public URL on success.
 */
export async function uploadBarnLogo(
  barnId: string,
  file: File,
): Promise<{ publicUrl: string } | { error: string }> {
  if (!isAllowedLogoImage(file)) {
    return { error: "Use JPEG, PNG, WebP, or SVG." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: "Logo must be under 2MB." };
  }

  const ext = file.type === "image/svg+xml" ? "svg"
    : file.type === "image/png" ? "png"
    : file.type === "image/webp" ? "webp"
    : "jpg";
  const path = `barn-logos/${barnId}/logo.${ext}?v=${Date.now()}`;
  // Path strip — Supabase doesn't like query string in path
  const cleanPath = path.split("?")[0];

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(cleanPath, file, {
      upsert: true,
      contentType: file.type,
    });

  if (upErr) return { error: upErr.message };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(cleanPath);
  // Append a cache-buster so the new logo displays immediately after upload
  return { publicUrl: `${data.publicUrl}?v=${Date.now()}` };
}
