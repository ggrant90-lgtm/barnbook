"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readImageForExtraction } from "@/lib/horse-documents";
import {
  createReceiptSignedUploadAction,
  attachReceiptToBarnLogAction,
} from "@/app/(protected)/actions/receipts";
import { createBarnLogAction } from "@/app/(protected)/actions/barn-logs";
import { supabase } from "@/lib/supabase";
import { HORSE_DOCUMENTS_BUCKET } from "@/lib/horse-documents";
import type { ExtractedReceiptData } from "@/lib/document-extraction-prompt";
import { BarnLogForm, type BarnLogInitial } from "@/components/barn-logs/BarnLogForm";

/**
 * Scan → extract → review → save flow for receipts.
 *
 * Structured as two visible stages (capture + review) so the modal
 * doesn't have to dance around a half-filled form while the LLM is
 * running. The review stage embeds the canonical BarnLogForm with
 * fields pre-populated from the extraction — that way every editing
 * affordance the user already knows works here, and the save path
 * hits the same createBarnLogAction the manual flow uses.
 *
 * After the log row is created, the receipt image is uploaded via
 * signed URL and then attached to the row. If either of those last
 * two steps fails, the log row still exists — we never lose the
 * structured data the user just reviewed.
 */

interface BarnClientOption {
  id: string;
  display_name: string;
  user_id: string | null;
  name_key: string;
}

interface BarnMember {
  id: string;
  name: string;
  role: string;
}

type Stage =
  | { kind: "capture" }
  | { kind: "extracting" }
  | { kind: "review"; extracted: ExtractedReceiptData; fileForUpload: File }
  | { kind: "error"; message: string };

export function ReceiptScanModal({
  barnId,
  barnName,
  hasBusinessPro,
  barnClients,
  barnMembers,
  customCategories,
  onClose,
}: {
  barnId: string;
  barnName: string;
  hasBusinessPro: boolean;
  barnClients: BarnClientOption[];
  barnMembers: BarnMember[];
  customCategories: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "capture" });
  const [pending, startTransition] = useTransition();

  /** Kick off the extract flow when the user picks / captures an image. */
  async function handleFile(file: File) {
    setStage({ kind: "extracting" });
    const prepared = await readImageForExtraction(file);
    if ("error" in prepared) {
      setStage({ kind: "error", message: prepared.error });
      return;
    }

    try {
      const res = await fetch("/api/documents/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: prepared.base64,
          mime_type: prepared.mime_type,
          barn_id: barnId,
          document_type: "receipt",
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setStage({
          kind: "error",
          message: payload.error ?? "Couldn't read the receipt.",
        });
        return;
      }
      const data = (await res.json()) as {
        extracted_data: ExtractedReceiptData;
      };
      setStage({
        kind: "review",
        extracted: data.extracted_data,
        fileForUpload: file,
      });
    } catch (e) {
      setStage({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error.",
      });
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  }

  /** Compose a BarnLogInitial from the extracted receipt fields so
   *  BarnLogForm renders pre-populated inputs the user can correct. */
  function extractedToInitial(
    extracted: ExtractedReceiptData,
  ): BarnLogInitial {
    // Line items roll up into notes — breaking them out into multi-
    // row storage is phase 2.
    const lineItemText = (extracted.line_items ?? [])
      .map((li) => {
        const qty = li.quantity != null ? `${li.quantity} × ` : "";
        const price = li.price != null ? ` — $${li.price}` : "";
        return `${qty}${li.description}${price}`;
      })
      .join("\n");
    const notes = [extracted.notes, lineItemText]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .join("\n\n");

    return {
      // id: empty string — BarnLogForm treats `initial` presence as
      // edit-mode, but we want a new-create flow. We pass initial as
      // undefined to the form and instead spread pre-populated state
      // via a separate `prefill` prop added to the form. See
      // BarnLogForm modifications below.
      id: "",
      performed_at: extracted.transaction_date
        ? `${extracted.transaction_date}T12:00:00Z`
        : new Date().toISOString(),
      category: extracted.suggested_category ?? "Other",
      total_cost: extracted.total_amount ?? 0,
      vendor_name: extracted.vendor_name,
      description: extracted.vendor_name
        ? `Receipt from ${extracted.vendor_name}`
        : "Receipt",
      notes: notes || null,
      cost_type: "expense",
      billable_to_user_id: null,
      billable_to_name: null,
      payment_status: null,
      paid_amount: null,
      paid_at: null,
    };
  }

  /** BarnLogForm is designed for create OR edit. For the scan flow
   *  we want create-with-prefills: use a simpler onSave override that
   *  wraps createBarnLogAction + upload + attach. */
  async function handleReviewSave(prefill: BarnLogInitial) {
    if (stage.kind !== "review") return;
    const file = stage.fileForUpload;
    const extracted = stage.extracted;
    startTransition(async () => {
      // Step 1: create the barn log row (so the data is safe even if
      // the upload fails).
      const createRes = await createBarnLogAction({
        barnId,
        performed_at: prefill.performed_at,
        category: prefill.category,
        total_cost: prefill.total_cost ?? 0,
        vendor_name: prefill.vendor_name ?? undefined,
        description: prefill.description ?? undefined,
        notes: prefill.notes ?? undefined,
        cost_type: prefill.cost_type ?? "expense",
        billable_to_user_id: prefill.billable_to_user_id ?? undefined,
        billable_to_name: prefill.billable_to_name ?? undefined,
        payment_status: prefill.payment_status ?? undefined,
        paid_amount: prefill.paid_amount ?? undefined,
        paid_at: prefill.paid_at ?? undefined,
      });
      if (createRes.error || !createRes.logId) {
        setStage({
          kind: "error",
          message: createRes.error ?? "Couldn't create the barn log.",
        });
        return;
      }
      const logId = createRes.logId;

      // Step 2: mint a signed upload URL, then upload the file.
      const uploadMeta = await createReceiptSignedUploadAction({
        barnId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      if (uploadMeta.error || !uploadMeta.upload) {
        // Log was created; only the image failed — tell the user but
        // still close the modal so they aren't stuck.
        setStage({
          kind: "error",
          message: `Log saved, but the image couldn't upload: ${uploadMeta.error}`,
        });
        router.refresh();
        return;
      }
      const { upload } = uploadMeta;
      const uploadResult = await supabase.storage
        .from(HORSE_DOCUMENTS_BUCKET)
        .uploadToSignedUrl(upload.file_path, upload.token, file, {
          contentType: upload.mime_type,
        });
      if (uploadResult.error) {
        setStage({
          kind: "error",
          message: `Log saved, but the image couldn't upload: ${uploadResult.error.message}`,
        });
        router.refresh();
        return;
      }

      // Step 3: attach the file + extraction payload to the row.
      const attachRes = await attachReceiptToBarnLogAction(logId, {
        file_path: upload.file_path,
        file_name: upload.file_name,
        mime_type: upload.mime_type,
        extracted,
      });
      if (attachRes.error) {
        setStage({
          kind: "error",
          message: `Log + image saved, but the link didn't attach: ${attachRes.error}`,
        });
        router.refresh();
        return;
      }

      onClose();
      router.refresh();
    });
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(42,64,49,0.75)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      className="sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sm:my-8 sm:rounded-2xl"
        style={{
          background: "white",
          width: "100%",
          maxWidth: 560,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: "100dvh",
        }}
      >
        {stage.kind === "capture" && (
          <div style={{ padding: 24 }}>
            <div className="font-serif text-lg font-semibold text-barn-dark">
              Scan a receipt
            </div>
            <p className="mt-2 text-sm text-barn-dark/60">
              Take a photo of a receipt or upload an image. BarnBook
              reads the vendor, total, and line items, and files it as
              a barn log at <span className="font-medium">{barnName}</span>.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPickFile}
              className="hidden"
            />
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl px-4 py-2 text-sm font-semibold shadow"
                style={{ background: "#c9a84c", color: "#2a4031" }}
              >
                📷 Take photo / upload
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {stage.kind === "extracting" && (
          <div style={{ padding: 40 }} className="text-center">
            <div className="font-serif text-lg text-barn-dark">
              Reading the receipt…
            </div>
            <p className="mt-2 text-sm text-barn-dark/60">
              Pulling vendor, total, and line items. This usually
              takes a few seconds.
            </p>
          </div>
        )}

        {stage.kind === "error" && (
          <div style={{ padding: 24 }}>
            <div className="font-serif text-lg text-barn-dark">
              Something went wrong
            </div>
            <p className="mt-2 text-sm text-barn-dark/70">{stage.message}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setStage({ kind: "capture" })}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {stage.kind === "review" && (
          <BarnLogForm
            barnId={barnId}
            barnName={barnName}
            hasBusinessPro={hasBusinessPro}
            barnMembers={barnMembers}
            barnClients={barnClients}
            customCategories={customCategories}
            // Pass as initial so the form renders edit-like pre-populated
            // inputs. We override the save path via `onExternalSave`
            // (added to BarnLogForm).
            initial={extractedToInitial(stage.extracted)}
            externalSave={handleReviewSave}
            externalSavePending={pending}
            externalSaveLabel="Save receipt"
            hideDelete
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
