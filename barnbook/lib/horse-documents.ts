import { supabase } from "@/lib/supabase";
import {
  createHorseDocumentSignedUploadAction,
  createPendingHorseDocumentSignedUploadAction,
} from "@/app/(protected)/actions/horse-documents";

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
 * Upload a horse document to the private horse-documents bucket via a
 * service-role-minted signed upload URL. Path: {barn_id}/{horse_id}/…
 *
 * The server action does the barn-owner / scanner-access check, then mints
 * the URL with the service role so the Storage upload itself bypasses RLS.
 * This sidesteps the SECURITY DEFINER helper fragility that 4d18c68 worked
 * around for horses_insert.
 */
export async function uploadHorseDocument(
  _barnId: string,
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

  const sig = await createHorseDocumentSignedUploadAction({
    horseId,
    fileName: file.name || "document",
    fileSize: file.size,
    mimeType: file.type,
  });
  if (sig.error || !sig.upload) {
    return { error: sig.error ?? "Failed to get upload URL" };
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(sig.upload.file_path, sig.upload.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (error) return { error: error.message };

  return {
    file_path: sig.upload.file_path,
    file_name: sig.upload.file_name,
    file_size_bytes: sig.upload.file_size_bytes,
    mime_type: sig.upload.mime_type,
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

  // HEIC / HEIF (iOS default) — decoded via libheif-wasm in the browser.
  // Claude vision doesn't accept HEIC, and Chrome on Android / most
  // desktop browsers can't decode it natively, so we convert to JPEG
  // up-front and then fall through to the normal downscale path. Lazy-
  // imported so only users who actually pick a HEIC file pay the WASM
  // download.
  let imageSource: Blob = file;
  if (file.type === "image/heic" || file.type === "image/heif") {
    try {
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });
      imageSource = Array.isArray(converted) ? converted[0] : converted;
    } catch (e) {
      return {
        error:
          e instanceof Error && e.message
            ? `Couldn't read HEIC image: ${e.message}`
            : "Couldn't read HEIC image. Save it as JPEG or PNG and try again.",
      };
    }
  }

  try {
    const bitmap = await createImageBitmap(imageSource);
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
    // createImageBitmap failed on a format we thought was decodeable.
    // Fall back to raw bytes only for formats Claude vision can handle;
    // otherwise surface the underlying error.
    const VISION_SAFE = new Set([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);
    const sourceType = imageSource.type || "image/jpeg";
    if (VISION_SAFE.has(sourceType)) {
      try {
        const buf = await imageSource.arrayBuffer();
        return { base64: arrayBufferToBase64(buf), mime_type: sourceType };
      } catch {
        /* fall through to generic error */
      }
    }
    return {
      error: e instanceof Error ? e.message : "Image processing failed.",
    };
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

/**
 * Upload a horse document BEFORE the horse exists (during the scan →
 * "create new horse" flow). File is parked under `{barn_id}/_pending/`
 * and the resulting file_path is passed forward to the new-horse form.
 * Once the horse is created, a horse_documents row just references this
 * existing path — no Storage move needed.
 *
 * Uploads go through a signed URL minted by the server action (service
 * role) so the upload itself doesn't hit Storage RLS.
 */
export async function uploadPendingHorseDocument(
  barnId: string,
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

  const sig = await createPendingHorseDocumentSignedUploadAction({
    barnId,
    fileName: file.name || "document",
    fileSize: file.size,
    mimeType: file.type,
  });
  if (sig.error || !sig.upload) {
    return { error: sig.error ?? "Failed to get upload URL" };
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(sig.upload.file_path, sig.upload.token, file, {
      contentType: file.type,
      upsert: false,
    });
  if (error) return { error: error.message };

  return {
    file_path: sig.upload.file_path,
    file_name: sig.upload.file_name,
    file_size_bytes: sig.upload.file_size_bytes,
    mime_type: sig.upload.mime_type,
  };
}

export const HORSE_DOCUMENTS_BUCKET = BUCKET;
