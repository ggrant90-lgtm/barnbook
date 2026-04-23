import { supabase } from "@/lib/supabase";

const BUCKET = "barn-media";

export function isAllowedImage(file: File): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

/** Upload barn logo to barn-media/{barnId}/logo.jpg */
export async function uploadBarnLogo(
  barnId: string,
  file: File,
): Promise<{ publicUrl: string } | { error: string }> {
  if (!isAllowedImage(file)) return { error: "Use JPEG, PNG, or WebP." };

  const path = `${barnId}/logo.jpg`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) return { error: upErr.message };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}

/** Upload barn banner to barn-media/{barnId}/banner.jpg */
export async function uploadBarnBanner(
  barnId: string,
  file: File,
): Promise<{ publicUrl: string } | { error: string }> {
  if (!isAllowedImage(file)) return { error: "Use JPEG, PNG, or WebP." };

  const path = `${barnId}/banner.jpg`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) return { error: upErr.message };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}

/** Upload a gallery photo to barn-media/{barnId}/gallery/{timestamp}.jpg */
export async function uploadBarnGalleryPhoto(
  barnId: string,
  file: File,
): Promise<{ publicUrl: string } | { error: string }> {
  if (!isAllowedImage(file)) return { error: "Use JPEG, PNG, or WebP." };

  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6);
  const path = `${barnId}/gallery/${ts}-${rand}.jpg`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (upErr) return { error: upErr.message };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}
