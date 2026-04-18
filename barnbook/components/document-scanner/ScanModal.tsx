"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readImageForExtraction, uploadHorseDocument } from "@/lib/horse-documents";
import {
  applyExtractionToHorseAction,
  createHorseDocumentAction,
} from "@/app/(protected)/actions/horse-documents";
import type { ExtractedHorseData } from "@/lib/document-extraction-prompt";
import type { MatchResult, MatchedHorse } from "@/lib/document-scanner/horse-matcher";
import { ConflictResolver, type FieldDecision } from "./ConflictResolver";

type Stage =
  | "capture"
  | "processing"
  | "review"
  | "saving"
  | "done"
  | "error";

export type ScanMode = "new_horse" | "existing_horse" | "dashboard";

export interface ScanResult {
  kind: "created" | "attached" | "prefill";
  horseId?: string;
  docId?: string;
  prefill?: ExtractedHorseData;
}

export function ScanModal({
  open,
  onClose,
  barnId,
  horseId,
  mode,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  barnId: string;
  horseId?: string;
  mode: ScanMode;
  onComplete?: (result: ScanResult) => void;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("capture");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedHorseData | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [chosenHorseId, setChosenHorseId] = useState<string | null>(
    horseId ?? null,
  );
  const [, startTransition] = useTransition();

  // Reset state whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setStage("capture");
    setError(null);
    setFile(null);
    setPreviewUrl(null);
    setExtracted(null);
    setMatch(null);
    setChosenHorseId(horseId ?? null);
  }, [open, horseId]);

  // Revoke object URLs on cleanup.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = useCallback(
    async (f: File) => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
      setStage("processing");
      setError(null);

      // PDFs bypass extraction in v1 — jump straight to "attach as-is" flow.
      if (f.type === "application/pdf") {
        setExtracted(null);
        setMatch(null);
        setStage("review");
        return;
      }

      // Read + downscale.
      const prepared = await readImageForExtraction(f);
      if ("error" in prepared) {
        setError(prepared.error);
        setStage("error");
        return;
      }

      // Extract.
      try {
        const res = await fetch("/api/documents/extract", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            image_base64: prepared.base64,
            mime_type: prepared.mime_type,
            barn_id: barnId,
            horse_id: horseId ?? undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? `Extraction failed (${res.status}).`);
          setStage("error");
          return;
        }
        const body = (await res.json()) as {
          extracted_data: ExtractedHorseData;
          match_result: MatchResult;
        };
        setExtracted(body.extracted_data);
        setMatch(body.match_result);
        if (body.match_result.matched_horse) {
          setChosenHorseId(body.match_result.matched_horse.id);
        }
        setStage("review");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Network error. Please try again.",
        );
        setStage("error");
      }
    },
    [barnId, horseId, previewUrl],
  );

  const handleSaveExisting = useCallback(
    async (horseIdToAttach: string, horsePatch: Record<string, string>) => {
      if (!file || !extracted) return;
      setStage("saving");
      setError(null);

      // Upload to storage first.
      const up = await uploadHorseDocument(barnId, horseIdToAttach, file);
      if ("error" in up) {
        setError(up.error);
        setStage("error");
        return;
      }

      startTransition(async () => {
        const res = await applyExtractionToHorseAction({
          horseId: horseIdToAttach,
          doc: {
            horseId: horseIdToAttach,
            document_type:
              extracted.document_type === "unknown"
                ? "other"
                : extracted.document_type,
            title:
              extracted.document_type === "coggins"
                ? `Coggins — ${extracted.test_date ?? "no date"}`
                : extracted.document_type === "registration"
                  ? `Registration — ${extracted.registry ?? "papers"}`
                  : extracted.document_type === "health_certificate"
                    ? "Health Certificate"
                    : extracted.document_type === "vet_record"
                      ? "Vet record"
                      : extracted.horse_name ?? "Document",
            file_path: up.file_path,
            file_name: up.file_name,
            file_size_bytes: up.file_size_bytes,
            mime_type: up.mime_type,
            extracted_data: extracted,
            scan_confidence: extracted.overall_confidence,
            document_date: extracted.document_date ?? extracted.test_date,
            expiration_date: extracted.expiration_date,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          horsePatch: horsePatch as any,
        });
        if (res.error) {
          setError(res.error);
          setStage("error");
          return;
        }
        setStage("done");
        onComplete?.({
          kind: "attached",
          horseId: horseIdToAttach,
          docId: res.docId,
        });
        router.refresh();
      });
    },
    [barnId, extracted, file, onComplete, router],
  );

  const handleSavePdf = useCallback(
    async (horseIdToAttach: string) => {
      if (!file) return;
      setStage("saving");
      setError(null);

      const up = await uploadHorseDocument(barnId, horseIdToAttach, file);
      if ("error" in up) {
        setError(up.error);
        setStage("error");
        return;
      }
      startTransition(async () => {
        const res = await createHorseDocumentAction({
          horseId: horseIdToAttach,
          document_type: "other",
          title: file.name.replace(/\.[^.]+$/, ""),
          file_path: up.file_path,
          file_name: up.file_name,
          file_size_bytes: up.file_size_bytes,
          mime_type: up.mime_type,
        });
        if (res.error) {
          setError(res.error);
          setStage("error");
          return;
        }
        setStage("done");
        onComplete?.({
          kind: "attached",
          horseId: horseIdToAttach,
          docId: res.docId,
        });
        router.refresh();
      });
    },
    [barnId, file, onComplete, router],
  );

  const handleCreateNewHorse = useCallback(() => {
    // No horse creation here — the extraction is returned to the caller
    // so it can pre-fill the /horses/new form.
    if (!extracted) return;
    onComplete?.({ kind: "prefill", prefill: extracted });
    onClose();
  }, [extracted, onComplete, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,64,49,0.7)",
        zIndex: 50,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: "env(safe-area-inset-top) 0 env(safe-area-inset-bottom)",
      }}
    >
      <div
        style={{
          background: "white",
          width: "100%",
          maxWidth: 900,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 0,
        }}
        className="sm:my-8 sm:max-h-[90vh] sm:rounded-2xl"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          <div>
            <div className="font-serif text-lg font-semibold text-barn-dark">
              Scan Document
            </div>
            <div className="text-xs text-barn-dark/60 mt-0.5">
              {stage === "capture" && "Take a photo or upload a file"}
              {stage === "processing" && "Reading your document…"}
              {stage === "review" && "Review and confirm"}
              {stage === "saving" && "Saving…"}
              {stage === "done" && "Done!"}
              {stage === "error" && "Something went wrong"}
            </div>
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

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {stage === "capture" && <CaptureStage onFile={handleFile} />}
          {stage === "processing" && <ProcessingStage previewUrl={previewUrl} />}
          {stage === "review" && (
            <>
              {file?.type === "application/pdf" ? (
                <PdfReviewStage
                  file={file}
                  previewUrl={previewUrl}
                  onSave={handleSavePdf}
                  chosenHorseId={chosenHorseId}
                  mode={mode}
                />
              ) : (
                extracted && (
                  <ReviewStage
                    extracted={extracted}
                    match={match}
                    previewUrl={previewUrl}
                    mode={mode}
                    onAttach={handleSaveExisting}
                    onCreateNew={handleCreateNewHorse}
                    forceHorseId={horseId}
                  />
                )
              )}
            </>
          )}
          {stage === "saving" && <ProcessingStage previewUrl={previewUrl} label="Saving…" />}
          {stage === "done" && (
            <div className="p-8 text-center">
              <div className="text-4xl mb-2">✓</div>
              <div className="font-serif text-lg text-barn-dark">
                Document saved
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-lg bg-brass-gold px-4 py-2 text-sm font-semibold text-barn-dark hover:brightness-110"
              >
                Close
              </button>
            </div>
          )}
          {stage === "error" && (
            <div className="p-6">
              <div
                className="rounded-lg px-4 py-3 text-sm"
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                }}
              >
                {error ?? "Something went wrong."}
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStage("capture");
                    setError(null);
                  }}
                  className="rounded-lg bg-brass-gold px-4 py-2 text-sm font-semibold text-barn-dark hover:brightness-110"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-barn-dark/15 bg-white px-4 py-2 text-sm font-medium text-barn-dark"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Stages
// ──────────────────────────────────────────────────────────────

function CaptureStage({ onFile }: { onFile: (f: File) => void }) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="rounded-2xl border border-barn-dark/10 bg-white p-6 text-left hover:border-brass-gold transition"
      >
        <div className="text-3xl mb-2">📷</div>
        <div className="font-serif text-base font-semibold text-barn-dark">
          Take a photo
        </div>
        <div className="text-xs text-barn-dark/60 mt-1">
          Use your phone camera to capture the document.
        </div>
      </button>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="rounded-2xl border border-barn-dark/10 bg-white p-6 text-left hover:border-brass-gold transition"
      >
        <div className="text-3xl mb-2">📎</div>
        <div className="font-serif text-base font-semibold text-barn-dark">
          Upload a file
        </div>
        <div className="text-xs text-barn-dark/60 mt-1">
          JPEG, PNG, HEIC. PDFs are stored as-is (no auto-extraction in v1).
        </div>
      </button>
    </div>
  );
}

function ProcessingStage({
  previewUrl,
  label,
}: {
  previewUrl: string | null;
  label?: string;
}) {
  return (
    <div className="p-6 flex flex-col items-center">
      <div
        style={{
          width: "100%",
          maxWidth: 360,
          aspectRatio: "3 / 4",
          background: "#f5efe2",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Document preview"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: 3,
            background:
              "linear-gradient(to right, transparent, #c9a84c, transparent)",
            animation: "scanline 1.6s linear infinite",
          }}
        />
      </div>
      <div className="mt-4 text-sm text-barn-dark/80">
        {label ?? "Reading your document…"}
      </div>
      <style>{`@keyframes scanline {
        0% { transform: translateY(0); }
        100% { transform: translateY(480px); }
      }`}</style>
    </div>
  );
}

function PdfReviewStage({
  file,
  previewUrl,
  onSave,
  chosenHorseId,
  mode,
}: {
  file: File;
  previewUrl: string | null;
  onSave: (horseId: string) => void;
  chosenHorseId: string | null;
  mode: ScanMode;
}) {
  return (
    <div className="p-6">
      <div className="text-sm text-barn-dark/70 mb-3">
        PDF auto-extraction isn't available in v1. This PDF will be stored
        as-is on the horse's profile. You can edit the document type + dates
        after uploading.
      </div>
      {previewUrl && (
        <div className="rounded-lg border border-barn-dark/10 bg-parchment/40 p-3 text-xs text-barn-dark/60 mb-4">
          📄 {file.name} ·{" "}
          {(file.size / 1024).toFixed(0)} KB
        </div>
      )}
      {mode === "existing_horse" && chosenHorseId ? (
        <button
          type="button"
          onClick={() => onSave(chosenHorseId)}
          className="rounded-lg bg-brass-gold px-4 py-2 text-sm font-semibold text-barn-dark hover:brightness-110"
        >
          Save to this horse
        </button>
      ) : (
        <div className="text-sm text-barn-dark/70">
          PDF attachment requires scanning from a specific horse's profile.
          Open the horse and tap Scan document from there.
        </div>
      )}
    </div>
  );
}

function ReviewStage({
  extracted,
  match,
  previewUrl,
  mode,
  onAttach,
  onCreateNew,
  forceHorseId,
}: {
  extracted: ExtractedHorseData;
  match: MatchResult | null;
  previewUrl: string | null;
  mode: ScanMode;
  onAttach: (horseId: string, horsePatch: Record<string, string>) => void;
  onCreateNew: () => void;
  forceHorseId?: string;
}) {
  const [selectedHorse, setSelectedHorse] = useState<MatchedHorse | null>(
    match?.matched_horse ?? null,
  );
  const [picking, setPicking] = useState(false);

  // Field-conflict decisions — only relevant when attaching to an existing horse.
  const [decisions, setDecisions] = useState<Record<string, FieldDecision>>({});

  const confidenceColor =
    match?.match_confidence === "high"
      ? "#22c55e"
      : match?.match_confidence === "medium"
        ? "#f59e0b"
        : "#ef4444";

  const saveToSelected = () => {
    if (!selectedHorse) return;
    const patch: Record<string, string> = {};
    for (const [key, decision] of Object.entries(decisions)) {
      if (decision.choice === "update" && decision.newValue) {
        patch[key] = decision.newValue;
      }
    }
    onAttach(selectedHorse.id, patch);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
      {/* Image */}
      <div
        style={{
          background: "#f5efe2",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          overflow: "hidden",
          aspectRatio: "3 / 4",
          maxHeight: 520,
        }}
      >
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Document"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        )}
      </div>

      {/* Right column */}
      <div>
        {/* Match summary */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: `1px solid ${confidenceColor}33`,
            background: `${confidenceColor}08`,
            marginBottom: 12,
          }}
        >
          <div className="text-xs uppercase tracking-wide text-barn-dark/60 mb-1">
            {match?.status === "exact_match"
              ? "Matched"
              : match?.status === "possible_match"
                ? "Possible match"
                : match?.status === "multiple_matches"
                  ? "Multiple matches"
                  : forceHorseId
                    ? "Attaching to this horse"
                    : "No match"}
          </div>
          <div className="text-sm text-barn-dark">
            {selectedHorse ? (
              <>
                <span className="font-medium">{selectedHorse.name}</span>
                {selectedHorse.registration_number && (
                  <span className="text-barn-dark/60 text-xs ml-2">
                    {selectedHorse.registration_number}
                  </span>
                )}
              </>
            ) : (
              "No horse selected"
            )}
          </div>
          {match?.match_reason && (
            <div className="text-xs text-barn-dark/60 mt-1">
              {match.match_reason}
            </div>
          )}
        </div>

        {/* Multiple matches picker */}
        {match?.status === "multiple_matches" && match.possible_horses && (
          <div className="mb-3">
            <div className="text-xs uppercase tracking-wide text-barn-dark/60 mb-1">
              Pick one
            </div>
            <div className="space-y-1">
              {match.possible_horses.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelectedHorse(h)}
                  className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${
                    selectedHorse?.id === h.id
                      ? "border-brass-gold bg-brass-gold/10"
                      : "border-barn-dark/10 bg-white hover:bg-parchment/50"
                  }`}
                >
                  <div className="font-medium text-barn-dark">{h.name}</div>
                  <div className="text-xs text-barn-dark/60">
                    {[h.breed, h.sex, h.color].filter(Boolean).join(" · ") ||
                      "—"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Extracted data */}
        <div className="mb-3">
          <div className="text-xs uppercase tracking-wide text-barn-dark/60 mb-1">
            Extracted
          </div>
          <ExtractedFields data={extracted} />
        </div>

        {/* Conflict resolver — only when attaching */}
        {selectedHorse && (
          <ConflictResolver
            extracted={extracted}
            existing={selectedHorse}
            onChange={setDecisions}
          />
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedHorse && (
            <button
              type="button"
              onClick={saveToSelected}
              className="rounded-lg bg-brass-gold px-4 py-2 text-sm font-semibold text-barn-dark hover:brightness-110"
            >
              {match?.status === "exact_match"
                ? "Confirm & attach"
                : `Attach to ${selectedHorse.name}`}
            </button>
          )}
          {mode !== "existing_horse" && (
            <button
              type="button"
              onClick={onCreateNew}
              className="rounded-lg border border-barn-dark/15 bg-white px-4 py-2 text-sm font-medium text-barn-dark hover:bg-parchment"
            >
              {match?.status === "no_match"
                ? "Create new horse"
                : "None of these — create new"}
            </button>
          )}
          {!selectedHorse && mode === "existing_horse" && (
            <div className="text-sm text-barn-dark/70">
              Scanner opened from a horse profile — extraction didn't return
              a match for this horse. You can still attach this document.
            </div>
          )}
        </div>

        {match?.status !== "no_match" && mode !== "existing_horse" && (
          <button
            type="button"
            onClick={() => setPicking(!picking)}
            className="mt-3 text-xs text-barn-dark/60 hover:text-barn-dark"
          >
            {picking ? "Cancel" : "This is a different horse"}
          </button>
        )}
      </div>
    </div>
  );
}

function ExtractedFields({ data }: { data: ExtractedHorseData }) {
  const rows: Array<[string, string | null]> = [
    ["Type", labelForType(data.document_type)],
    ["Name", data.horse_name],
    ["Breed", data.breed],
    ["Sex", data.sex],
    ["Color", data.color],
    ["Foal date", data.foal_date],
    ["Registration", data.registration_number],
    ["Sire", data.sire],
    ["Dam", data.dam],
    ["Owner", data.owner_name],
    ["Vet", data.vet_name],
    ["Test date", data.test_date],
    ["Test result", data.test_result],
    ["Expires", data.expiration_date],
    ["Microchip", data.microchip_number],
  ];
  const visible = rows.filter(([, v]) => !!v && v !== "");
  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Couldn't extract any fields. The image might be too blurry, partial,
        or not a horse document.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-barn-dark/10 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {visible.map(([label, value]) => (
            <tr key={label} className="border-b border-barn-dark/5 last:border-0">
              <td className="px-3 py-1.5 text-xs uppercase tracking-wide text-barn-dark/55 w-1/3">
                {label}
              </td>
              <td className="px-3 py-1.5 text-barn-dark">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function labelForType(t: ExtractedHorseData["document_type"]): string {
  switch (t) {
    case "coggins":
      return "Coggins test";
    case "registration":
      return "Registration papers";
    case "health_certificate":
      return "Health certificate";
    case "vet_record":
      return "Vet record";
    default:
      return "Unknown";
  }
}
