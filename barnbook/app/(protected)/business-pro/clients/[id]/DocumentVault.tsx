"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CLIENT_DOCUMENT_TYPES,
  CLIENT_DOCUMENT_TYPE_LABELS,
  type ClientDocumentType,
} from "@/lib/business-pro-constants";
import { uploadClientDocument } from "@/lib/client-documents";
import {
  createClientDocumentAction,
  deleteClientDocumentAction,
  getClientDocumentSignedUrlAction,
} from "@/app/(protected)/actions/clients";

interface Doc {
  id: string;
  doc_type: string;
  custom_label: string | null;
  title: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  effective_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

export function DocumentVault({
  clientId,
  barnId,
  documents,
}: {
  clientId: string;
  barnId: string;
  documents: Doc[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload form state
  const [docType, setDocType] = useState<ClientDocumentType>("boarding_agreement");
  const [customLabel, setCustomLabel] = useState("");
  const [title, setTitle] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [stagedFile, setStagedFile] = useState<File | null>(null);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setStagedFile(f);
    if (f && !title) {
      // Default title to filename stem
      const stem = f.name.replace(/\.[^.]+$/, "");
      setTitle(stem);
    }
  };

  const handleUpload = async () => {
    if (!stagedFile) {
      setError("Pick a file first.");
      return;
    }
    if (!title.trim()) {
      setError("Give it a title.");
      return;
    }
    setError(null);
    setUploading(true);

    const upRes = await uploadClientDocument(barnId, clientId, stagedFile);
    if ("error" in upRes) {
      setError(upRes.error);
      setUploading(false);
      return;
    }

    const res = await createClientDocumentAction({
      clientId,
      title,
      doc_type: docType,
      custom_label: docType === "other" ? customLabel : null,
      file_path: upRes.file_path,
      file_name: upRes.file_name,
      file_size_bytes: upRes.file_size_bytes,
      mime_type: upRes.mime_type,
      effective_date: effectiveDate || null,
      expiry_date: expiryDate || null,
    });

    setUploading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    // Reset + refresh
    setStagedFile(null);
    setTitle("");
    setCustomLabel("");
    setEffectiveDate("");
    setExpiryDate("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  };

  const handleDownload = (docId: string) => {
    startTransition(async () => {
      const res = await getClientDocumentSignedUrlAction(docId);
      if (res.error || !res.url) {
        alert(`Download failed: ${res.error ?? "unknown error"}`);
        return;
      }
      // Open in a new tab — browser will stream or prompt to save
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const handleDelete = (docId: string) => {
    if (!confirm("Delete this document? The file and record will be removed.")) return;
    startTransition(async () => {
      const res = await deleteClientDocumentAction(docId);
      if (res.error) {
        alert(`Delete failed: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  const today = new Date().toISOString().slice(0, 10);
  const in30 = (d: string) => {
    const diff =
      (new Date(d).getTime() - new Date(today).getTime()) /
      (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  };

  return (
    <div>
      {/* Upload card */}
      <div
        style={{
          background: "white",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h3 className="font-serif text-base font-semibold text-barn-dark mb-3">
          Upload document
        </h3>
        {error && (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-xs"
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-barn-dark/60">
              Type
            </span>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as ClientDocumentType)}
              className="bp-select w-full"
            >
              {CLIENT_DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CLIENT_DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {docType === "other" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-barn-dark/60">
                Custom label
              </span>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. Lease Addendum"
                className="bp-input w-full"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-barn-dark/60">
              Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2026 Boarding Agreement"
              className="bp-input w-full"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-barn-dark/60">
              Effective date
            </span>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="bp-input w-full"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-barn-dark/60">
              Expiry date
            </span>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="bp-input w-full"
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-barn-dark/60">
              File (PDF or Word, max 20 MB)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFilePick}
              className="bp-input w-full"
            />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !stagedFile || !title.trim()}
            className="rounded-lg bg-brass-gold px-4 py-2 text-sm font-semibold text-barn-dark hover:brightness-110 disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="rounded-2xl border border-barn-dark/10 bg-white p-8 text-center text-sm text-barn-dark/60">
          No documents yet. Upload a boarding agreement, waiver, or proposal to
          keep everything in one place.
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => {
            const expired = d.expiry_date && d.expiry_date < today;
            const soon = d.expiry_date && in30(d.expiry_date) && !expired;
            const typeLabel =
              d.doc_type === "other" && d.custom_label
                ? d.custom_label
                : CLIENT_DOCUMENT_TYPE_LABELS[
                    d.doc_type as ClientDocumentType
                  ] ?? d.doc_type;
            return (
              <div
                key={d.id}
                className="rounded-2xl border border-barn-dark/10 bg-white px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: "rgba(139,74,43,0.08)",
                        color: "#8b4a2b",
                      }}
                    >
                      {typeLabel}
                    </span>
                    <span className="font-medium text-barn-dark truncate">
                      {d.title}
                    </span>
                    {expired && (
                      <span
                        className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono uppercase"
                        style={{
                          background: "#fee2e2",
                          color: "#991b1b",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Expired
                      </span>
                    )}
                    {soon && (
                      <span
                        className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono uppercase"
                        style={{
                          background: "#fef3c7",
                          color: "#92400e",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Expires soon
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-barn-dark/60 mt-0.5 truncate">
                    {d.file_name} ·{" "}
                    {(d.file_size_bytes / 1024).toFixed(0)} KB
                    {d.effective_date && (
                      <> · Effective {formatDate(d.effective_date)}</>
                    )}
                    {d.expiry_date && (
                      <> · Expires {formatDate(d.expiry_date)}</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(d.id)}
                  disabled={pending}
                  className="rounded-lg border border-barn-dark/15 bg-white px-3 py-1.5 text-xs font-medium text-barn-dark hover:bg-parchment disabled:opacity-40"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  disabled={pending}
                  className="text-xs text-barn-dark/60 hover:text-[#b8421f]"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}
