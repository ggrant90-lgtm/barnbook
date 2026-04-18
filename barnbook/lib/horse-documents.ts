import { supabase } from "@/lib/supabase";

const BUCKET = "horse-documents";

export const ALLOWED_HORSE_DOC_MIME = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export const MAX_HORSE_DOC_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

export const CLIENT_IMAGE_DOWNSCALE_MAX_WIDTH = 2048;

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(0, 120);
  return trimmed
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._\-]/g, "");
}

export function isAllowedHorseDoc(file: File): boolean {
  return (ALLOWED_HORSE_DOC_MIME as readonly string[]).includes(file.type);
}

export interface UploadedHorseDoc {
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
}

/**
 * Upload a horse document to the private horse-documents bucket.
 *
 * Path: {barn_id}/{horse_id}/{uuid}-{safe_filename}
 *
 * Storage RLS (see migration manual step) enforces that only barn members
 * and owners can upload. Every download goes through a signed URL via the
 * `getHorseDocumentSignedUrlAction` server action.
 */
export async function uploadHorseDocument(
  barnId: string,
  horseId: string,
  file: File,
): Promise<UploadedHorseDoc | { error: string }> {
  if (!isAllowedHorseDoc(file)) {
    return { error: "Only JPEG, PNG, HEIC, or PDF files are accepted." };
  }
  if (file.size > MAX_HORSE_DOC_SIZE_BYTES) {
    return {
      error: `File is too large. Maximum size is ${
        MAX_HORSE_DOC_SIZE_BYTES / (1024 * 1024)
      } MB.`,
    };
  }

  const safeName = sanitizeFileName(file.name) || "document";
  const uniq =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${barnId}/${horseId}/${uniq}-${safeName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) return { error: error.message };

  return {
    file_path: path,
    file_name: file.name,
    file_size_bytes: file.size,
    mime_type: file.type,
  };
}

/**
 * Browser-side: read a File as base64 and downscale if it's wider than
 * CLIENT_IMAGE_DOWNSCALE_MAX_WIDTH. Returns { base64, mimeType } ready to
 * POST to the extraction API.
 *
 * Downscaling cuts Claude API cost ~3x on modern phone photos with no
 * meaningful OCR quality loss. PDFs are passed through untouched (no
 * downscale path for v1 — PDFs bypass extraction anyway).
 */
export async function readImageForExtraction(
  file: File,
): Promise<{ base64: string; mime_type: string } | { error: string }> {
  if (file.type === "application/pdf") {
    // PDFs aren't extracted in v1 — return the raw base64 for future use.
    const buf = await file.arrayBuffer();
    return {
      base64: arrayBufferToBase64(buf),
      mime_type: file.type,
    };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "Unsupported file type for extraction." };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width > CLIENT_IMAGE_DOWNSCALE_MAX_WIDTH
      ? CLIENT_IMAGE_DOWNSCALE_MAX_WIDTH / bitmap.width
      : 1;
    const width = Math.round(bitmap.width * ratio);
    const height = Math.round(bitmap.height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { error: "Browser does not support canvas 2D." };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    // JPEG at 0.85 quality is the sweet spot for photo documents.
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
    });
    if (!blob) return { error: "Failed to encode image." };
    const buf = await blob.arrayBuffer();
    return {
      base64: arrayBufferToBase64(buf),
      mime_type: "image/jpeg",
    };
  } catch (e) {
    // Fall back to raw file bytes if createImageBitmap fails (e.g., HEIC on
    // some browsers). Claude vision can still handle the original.
    try {
      const buf = await file.arrayBuffer();
      return { base64: arrayBufferToBase64(buf), mime_type: file.type };
    } catch {
      return {
        error: e instanceof Error ? e.message : "Image processing failed.",
      };
    }
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(i, Math.min(i + chunkSize, bytes.length)),
    );
  }
  return btoa(binary);
}

export const HORSE_DOCUMENTS_BUCKET = BUCKET;
