import { supabase } from "@/lib/supabase";
import {
  ALLOWED_CLIENT_DOC_MIME,
  MAX_CLIENT_DOC_SIZE_BYTES,
} from "@/lib/business-pro-constants";

const BUCKET = "client-documents";

/** Strip characters that would break a Storage path, keep readability. */
function sanitizeFileName(name: string): string {
  // Cap length, collapse whitespace, replace path-hostile chars
  const trimmed = name.trim().slice(0, 120);
  return trimmed
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._\-]/g, "");
}

export function isAllowedClientDoc(file: File): boolean {
  return (ALLOWED_CLIENT_DOC_MIME as readonly string[]).includes(file.type);
}

export interface UploadedClientDoc {
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
}

/**
 * Upload a client document to the private client-documents bucket.
 * Storage RLS policies enforce barn-owner-only insert.
 *
 * Path convention: {barn_id}/{client_id}/{uuid}-{safe_filename}
 *   (barn_id is the first path segment so the RLS policy can parse it.)
 */
export async function uploadClientDocument(
  barnId: string,
  clientId: string,
  file: File,
): Promise<UploadedClientDoc | { error: string }> {
  if (!isAllowedClientDoc(file)) {
    return { error: "Only PDF and Word documents are accepted." };
  }
  if (file.size > MAX_CLIENT_DOC_SIZE_BYTES) {
    return {
      error: `File is too large. Maximum size is ${
        MAX_CLIENT_DOC_SIZE_BYTES / (1024 * 1024)
      } MB.`,
    };
  }

  const safeName = sanitizeFileName(file.name) || "document";
  // crypto.randomUUID is available in modern browsers + Node 19+
  const uniq =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${barnId}/${clientId}/${uniq}-${safeName}`;

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

/** Bucket name exported so server actions can touch Storage directly. */
export const CLIENT_DOCUMENTS_BUCKET = BUCKET;
