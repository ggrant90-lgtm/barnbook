import { supabase } from "./supabase";

const BUCKET = "log-media";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

export type MediaType = "photo" | "video";

function getMediaType(file: File): MediaType | null {
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return "photo";
  if (ALLOWED_VIDEO_TYPES.includes(file.type)) return "video";
  return null;
}

export async function uploadLogMedia(
  logType: "activity" | "health",
  logId: string,
  file: File,
): Promise<{ url: string; mediaType: MediaType } | { error: string }> {
  const mediaType = getMediaType(file);
  if (!mediaType) {
    return { error: "Unsupported file type. Use JPG, PNG, WebP for photos or MP4/MOV for videos." };
  }

  const maxSize = mediaType === "photo" ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    return { error: `File too large. Maximum ${limitMB}MB for ${mediaType}s.` };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? (mediaType === "photo" ? "jpg" : "mp4");
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${logType}/${logId}/${ts}-${rand}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return { url: urlData.publicUrl, mediaType };
}
