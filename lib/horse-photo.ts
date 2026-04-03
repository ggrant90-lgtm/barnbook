import { supabase } from "@/lib/supabase";

export const HORSE_PHOTOS_BUCKET = "horse-photos";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function isAllowedHorseImage(file: File): boolean {
  return (ALLOWED_TYPES as readonly string[]).includes(file.type);
}

/** Storage path: `{horseId}/{timestamp-random}.{ext}` */
export function buildHorsePhotoObjectPath(horseId: string, file: File): string {
  const raw = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ext = ["jpg", "jpeg", "png", "webp"].includes(raw)
    ? raw === "jpeg"
      ? "jpg"
      : raw
    : "jpg";
  return `${horseId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
}

export async function uploadHorsePhoto(
  horseId: string,
  file: File,
): Promise<{ publicUrl: string } | { error: string }> {
  if (!isAllowedHorseImage(file)) {
    return { error: "Please use JPEG, PNG, or WebP." };
  }

  const path = buildHorsePhotoObjectPath(horseId, file);
  const { error } = await supabase.storage
    .from(HORSE_PHOTOS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) return { error: error.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(HORSE_PHOTOS_BUCKET).getPublicUrl(path);

  return { publicUrl };
}

/** Storage path: `{horseId}/enroll/{poseKey}-{timestamp}.{ext}` */
export function buildEnrollmentPhotoPath(
  horseId: string,
  poseKey: string,
  file: File,
): string {
  const raw = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ext = ["jpg", "jpeg", "png", "webp"].includes(raw)
    ? raw === "jpeg"
      ? "jpg"
      : raw
    : "jpg";
  return `${horseId}/enroll/${poseKey}-${Date.now()}.${ext}`;
}

export async function uploadEnrollmentPhoto(
  horseId: string,
  poseKey: string,
  file: File,
): Promise<{ publicUrl: string } | { error: string }> {
  if (!isAllowedHorseImage(file)) {
    return { error: "Please use JPEG, PNG, or WebP." };
  }

  const path = buildEnrollmentPhotoPath(horseId, poseKey, file);
  const { error } = await supabase.storage
    .from(HORSE_PHOTOS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (error) return { error: error.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from(HORSE_PHOTOS_BUCKET).getPublicUrl(path);

  return { publicUrl };
}
