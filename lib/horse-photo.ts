import { supabase } from "@/lib/supabase";

const BUCKET = "horse-photos";

export function isAllowedHorseImage(file: File): boolean {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

/**
 * Upload profile image to `horse-photos/{horseId}/profile.jpg` and return public URL.
 */
export async function uploadHorseProfilePhoto(
  horseId: string,
  file: File,
): Promise<{ publicUrl: string } | { error: string }> {
  if (!isAllowedHorseImage(file)) {
    return { error: "Use JPEG, PNG, or WebP." };
  }

  const path = `${horseId}/profile.jpg`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

  if (upErr) {
    return { error: upErr.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl };
}
