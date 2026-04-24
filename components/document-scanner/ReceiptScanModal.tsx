"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readImageForExtraction } from "@/lib/horse-documents";
import {
  createReceiptSignedUploadAction,
  attachReceiptToBarnLogAction,
  createSplitReceiptLogsAction,
} from "@/app/(protected)/actions/receipts";
import { createBarnLogAction } from "@/app/(protected)/actions/barn-logs";
import { supabase } from "@/lib/supabase";
import { HORSE_DOCUMENTS_BUCKET } from "@/lib/horse-documents";
import type { ExtractedReceiptData } from "@/lib/document-extraction-prompt";
import { BARN_LOG_CATEGORIES } from "@/lib/business-pro-constants";
import { ErrorDetails } from "@/components/ui/ErrorDetails";

/**
 * Scan → extract → review → save flow for receipts.
 *
 * Review step is a purpose-built form (not a BarnLogForm embed) so it
 * can handle the receipt-only controls cleanly: a barn picker for
 * multi-barn users and an optional "split across categories" expander
 * that lets a single receipt produce N barn_expenses rows all tied
 * to the same receipt image.
 *
 * After the row(s) are created, the receipt image is uploaded via
 * signed URL and attached. The single-row path uses
 * createBarnLogAction + attachReceiptToBarnLogAction; the split path
 * uses createSplitReceiptLogsAction which atomically inserts all
 * rows with receipt fields already populated.
 */

interface BarnOption {
  id: string;
  name: string;
}

type Stage =
  | { kind: "capture" }
  | { kind: "extracting" }
  | { kind: "review"; extracted: ExtractedReceiptData; fileForUpload: File }
  | { kind: "error"; message: string };

export function ReceiptScanModal({
  barnId,
  barnName,
  writableBarns,
  onClose,
}: {
  /** Currently-active barn id — used as the default barn for the
   *  scan. When writableBarns has more than one entry the user can
   *  change it in the review step. */
  barnId: string;
  barnName: string;
  /** Every barn the user can write to (owner or editor member). */
  writableBarns: BarnOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "capture" });

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
          maxWidth: 620,
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
              a barn log
              {writableBarns.length <= 1 ? (
                <>
                  {" "}at <span className="font-medium">{barnName}</span>.
                </>
              ) : (
                <> — you can pick which barn in the next step.</>
              )}
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
          <ReceiptReviewForm
            defaultBarnId={barnId}
            writableBarns={writableBarns}
            extracted={stage.extracted}
            file={stage.fileForUpload}
            onClose={onClose}
            onAfterSave={() => {
              router.refresh();
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Review form — purpose-built for the receipt flow.
// ────────────────────────────────────────────────────────────────────────

type SplitLine = {
  // Stable key for React reorderless updates.
  key: string;
  description: string;
  amount: number;
  category: string;
};

function mkKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ReceiptReviewForm({
  defaultBarnId,
  writableBarns,
  extracted,
  file,
  onClose,
  onAfterSave,
}: {
  defaultBarnId: string;
  writableBarns: BarnOption[];
  extracted: ExtractedReceiptData;
  file: File;
  onClose: () => void;
  onAfterSave: () => void;
}) {
  // Single-row state (default path).
  const [barnId, setBarnId] = useState(defaultBarnId);
  const [date, setDate] = useState<string>(
    extracted.transaction_date ??
      new Date().toISOString().slice(0, 10),
  );
  const [category, setCategory] = useState<string>(
    extracted.suggested_category ?? "Other",
  );
  const [vendor, setVendor] = useState(extracted.vendor_name ?? "");
  const [description, setDescription] = useState(
    extracted.vendor_name ? `Receipt from ${extracted.vendor_name}` : "Receipt",
  );
  const [cost, setCost] = useState<string>(
    extracted.total_amount != null ? String(extracted.total_amount) : "",
  );
  const lineItemText = useMemo(
    () =>
      (extracted.line_items ?? [])
        .map((li) => {
          const qty = li.quantity != null ? `${li.quantity} × ` : "";
          const price = li.price != null ? ` — $${li.price}` : "";
          return `${qty}${li.description}${price}`;
        })
        .join("\n"),
    [extracted.line_items],
  );
  const [notes, setNotes] = useState<string>(
    [extracted.notes, lineItemText]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .join("\n\n"),
  );

  // Split state — starts collapsed. When opened, seeds line rows from
  // the extraction so the user can adjust + assign categories.
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitLines, setSplitLines] = useState<SplitLine[]>(() =>
    (extracted.line_items ?? []).map((li) => ({
      key: mkKey(),
      description: li.description,
      amount: li.price ?? 0,
      category: extracted.suggested_category ?? "Other",
    })),
  );

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const splitTotal = splitLines.reduce(
    (sum, l) => sum + (Number.isFinite(l.amount) ? l.amount : 0),
    0,
  );
  const headerTotal = cost.trim() ? parseFloat(cost.trim()) : 0;
  const splitMismatch =
    splitOpen && Math.abs(splitTotal - headerTotal) > 0.01;

  // Uploads the file to storage under the current barn's path, returns
  // the signed-upload result. Shared between single + split paths.
  async function uploadReceipt(forBarnId: string) {
    const meta = await createReceiptSignedUploadAction({
      barnId: forBarnId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    if (meta.error || !meta.upload) {
      return { error: meta.error ?? "Failed to get upload URL" };
    }
    const { error } = await supabase.storage
      .from(HORSE_DOCUMENTS_BUCKET)
      .uploadToSignedUrl(meta.upload.file_path, meta.upload.token, file, {
        contentType: meta.upload.mime_type,
      });
    if (error) return { error: error.message };
    return { upload: meta.upload };
  }

  function handleSave() {
    setError(null);

    const costNumber = headerTotal;
    // ── Split path ─────────────────────────────────────────────────
    if (splitOpen) {
      if (splitLines.length === 0) {
        setError("Add at least one line before saving the split.");
        return;
      }
      for (const l of splitLines) {
        if (!l.category.trim()) {
          setError("Every line needs a category.");
          return;
        }
        if (!(l.amount > 0)) {
          setError("Every line needs an amount greater than zero.");
          return;
        }
      }

      startTransition(async () => {
        // Step 1: upload the receipt image.
        const up = await uploadReceipt(barnId);
        if ("error" in up) {
          setError(`Couldn't upload the image: ${up.error}`);
          return;
        }

        // Step 2: create all split rows atomically, each pointing at
        // the same receipt + group_id.
        const res = await createSplitReceiptLogsAction({
          barnId,
          receipt: {
            file_path: up.upload.file_path,
            file_name: up.upload.file_name,
            mime_type: up.upload.mime_type,
            extracted,
          },
          splits: splitLines.map((l) => ({
            category: l.category,
            total_cost: l.amount,
            description: l.description,
            vendor_name: vendor.trim() || null,
            notes: null,
            performed_at: new Date(`${date}T12:00:00Z`).toISOString(),
            cost_type: "expense",
          })),
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        onAfterSave();
      });
      return;
    }

    // ── Single-row path ───────────────────────────────────────────
    if (!category.trim()) {
      setError("Pick a category.");
      return;
    }
    if (!description.trim()) {
      setError("Add a short description.");
      return;
    }
    startTransition(async () => {
      // Create the row first.
      const createRes = await createBarnLogAction({
        barnId,
        performed_at: new Date(`${date}T12:00:00Z`).toISOString(),
        category: category.trim(),
        total_cost: costNumber,
        vendor_name: vendor.trim() || undefined,
        description: description.trim(),
        notes: notes.trim() || undefined,
        cost_type: "expense",
      });
      if (createRes.error || !createRes.logId) {
        setError(createRes.error ?? "Couldn't create the barn log.");
        return;
      }
      const logId = createRes.logId;

      // Upload image.
      const up = await uploadReceipt(barnId);
      if ("error" in up) {
        setError(`Log saved, but the image couldn't upload: ${up.error}`);
        onAfterSave();
        return;
      }

      // Attach.
      const attach = await attachReceiptToBarnLogAction(logId, {
        file_path: up.upload.file_path,
        file_name: up.upload.file_name,
        mime_type: up.upload.mime_type,
        extracted,
      });
      if (attach.error) {
        setError(
          `Log + image saved, but the link didn't attach: ${attach.error}`,
        );
        onAfterSave();
        return;
      }
      onAfterSave();
    });
  }

  const mergedCategories = [...BARN_LOG_CATEGORIES];
  const confidenceWarning = extracted.confidence === "low";

  return (
    <>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div className="font-serif text-lg font-semibold text-barn-dark">
          Review receipt
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-barn-dark/60 hover:bg-parchment"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }} className="space-y-3">
        {confidenceWarning && (
          <div
            className="rounded-lg border px-3 py-2 text-xs"
            style={{
              borderColor: "rgba(184,66,31,0.3)",
              background: "rgba(184,66,31,0.08)",
              color: "#7a2f16",
            }}
          >
            Low confidence — double-check the extracted fields before saving.
          </div>
        )}

        {writableBarns.length > 1 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Barn
            </span>
            <select
              value={barnId}
              onChange={(e) => setBarnId(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 outline-none"
              style={{
                borderColor: "rgba(42,64,49,0.15)",
                color: "#2a4031",
                background: "white",
              }}
            >
              {writableBarns.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
            Date
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 outline-none"
            style={{
              borderColor: "rgba(42,64,49,0.15)",
              color: "#2a4031",
              background: "white",
            }}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Vendor
            </span>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Vendor name"
              className="w-full rounded-xl border px-4 py-3 outline-none"
              style={{ borderColor: "rgba(42,64,49,0.15)" }}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
              Total
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="$"
              className="w-full rounded-xl border px-4 py-3 outline-none"
              style={{ borderColor: "rgba(42,64,49,0.15)" }}
            />
          </label>
        </div>

        {!splitOpen && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
                Category
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{
                  borderColor: "rgba(42,64,49,0.15)",
                  color: "#2a4031",
                  background: "white",
                }}
              >
                {mergedCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
                Description
              </span>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-barn-dark/80">
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border px-4 py-3 outline-none"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              />
            </label>
          </>
        )}

        {/* Split expander */}
        <div
          className="rounded-xl border px-3 py-2"
          style={{
            borderColor: "rgba(42,64,49,0.12)",
            background: "rgba(42,64,49,0.03)",
          }}
        >
          <button
            type="button"
            onClick={() => setSplitOpen((v) => !v)}
            className="text-sm font-medium text-barn-dark/85"
          >
            {splitOpen ? "▾" : "▸"} Split into multiple categories{" "}
            {!splitOpen && splitLines.length > 0 && (
              <span className="text-xs text-barn-dark/55">
                ({splitLines.length} item{splitLines.length === 1 ? "" : "s"}{" "}
                detected)
              </span>
            )}
          </button>
          {splitOpen && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-barn-dark/55">
                Creates one barn log per line, each with its own category
                but all sharing this receipt image. Useful when a single
                receipt covers multiple expense types.
              </p>
              {splitLines.length === 0 ? (
                <div className="text-xs text-barn-dark/60">
                  No line items detected. Add one below.
                </div>
              ) : (
                splitLines.map((l, i) => (
                  <div
                    key={l.key}
                    className="rounded-lg border bg-white px-3 py-2"
                    style={{ borderColor: "rgba(42,64,49,0.12)" }}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={l.description}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSplitLines((prev) =>
                            prev.map((x, idx) =>
                              idx === i ? { ...x, description: v } : x,
                            ),
                          );
                        }}
                        placeholder="Description"
                        className="flex-1 rounded-md border px-2 py-1 text-sm outline-none"
                        style={{ borderColor: "rgba(42,64,49,0.15)" }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={l.amount}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setSplitLines((prev) =>
                            prev.map((x, idx) =>
                              idx === i
                                ? {
                                    ...x,
                                    amount: Number.isFinite(v) ? v : 0,
                                  }
                                : x,
                            ),
                          );
                        }}
                        placeholder="$"
                        className="w-24 rounded-md border px-2 py-1 text-sm outline-none"
                        style={{ borderColor: "rgba(42,64,49,0.15)" }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setSplitLines((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="rounded-md px-1.5 py-1 text-xs text-barn-dark/50 hover:text-[#b8421f]"
                        aria-label="Remove line"
                        title="Remove line"
                      >
                        ✕
                      </button>
                    </div>
                    <select
                      value={l.category}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSplitLines((prev) =>
                          prev.map((x, idx) =>
                            idx === i ? { ...x, category: v } : x,
                          ),
                        );
                      }}
                      className="mt-2 w-full rounded-md border px-2 py-1 text-xs outline-none"
                      style={{
                        borderColor: "rgba(42,64,49,0.15)",
                        background: "white",
                      }}
                    >
                      {mergedCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
              <button
                type="button"
                onClick={() =>
                  setSplitLines((prev) => [
                    ...prev,
                    {
                      key: mkKey(),
                      description: "",
                      amount: 0,
                      category: "Other",
                    },
                  ])
                }
                className="rounded-md border px-2.5 py-1 text-xs font-medium text-barn-dark/75"
                style={{ borderColor: "rgba(42,64,49,0.15)" }}
              >
                + Add line
              </button>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-barn-dark/55">
                  Split total: ${splitTotal.toFixed(2)}
                </span>
                {splitMismatch && (
                  <span style={{ color: "#b8421f" }}>
                    Doesn&apos;t match receipt total (${headerTotal.toFixed(2)})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {error && (
          <ErrorDetails
            title="Couldn't save"
            message={error}
            extra={{ Barn: barnId }}
          />
        )}
      </div>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-xl border px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment disabled:opacity-50"
          style={{ borderColor: "rgba(42,64,49,0.15)" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="rounded-xl px-5 py-2 text-sm font-semibold shadow disabled:opacity-60"
          style={{ background: "#c9a84c", color: "#2a4031" }}
        >
          {pending
            ? "Saving…"
            : splitOpen
              ? `Save ${splitLines.length} log${splitLines.length === 1 ? "" : "s"}`
              : "Save receipt"}
        </button>
      </div>
    </>
  );
}
