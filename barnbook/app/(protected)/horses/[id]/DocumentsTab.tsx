"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ScanEntryButton } from "@/components/document-scanner/ScanEntryButton";
import { DocumentViewer } from "@/components/document-scanner/DocumentViewer";
import { ErrorDetails } from "@/components/ui/ErrorDetails";
import { deleteHorseDocumentAction } from "@/app/(protected)/actions/horse-documents";

export interface HorseDocumentRow {
  id: string;
  document_type: "coggins" | "registration" | "health_certificate" | "vet_record" | "other";
  title: string | null;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  scan_confidence: "high" | "medium" | "low" | null;
  document_date: string | null;
  expiration_date: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<HorseDocumentRow["document_type"], string> = {
  coggins: "Coggins",
  registration: "Registration",
  health_certificate: "Health Cert.",
  vet_record: "Vet Record",
  other: "Document",
};

export function DocumentsTab({
  horseId,
  barnId,
  canEdit,
  documents,
}: {
  horseId: string;
  barnId: string;
  canEdit: boolean;
  documents: HorseDocumentRow[];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  // Expiration banner: any doc expiring within 30 days?
  const expiring = useMemo(() => {
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + 30);
    return documents.find((d) => {
      if (!d.expiration_date) return false;
      const exp = new Date(d.expiration_date);
      return exp >= now && exp <= limit;
    });
  }, [documents]);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Two-tap confirm: first tap on Delete arms the row, second actually deletes.
  // Replaces window.confirm() which is silently blocked in some installed
  // PWA contexts on iOS.
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  // Which document (if any) is being viewed in the inline modal.
  const [viewingDoc, setViewingDoc] = useState<HorseDocumentRow | null>(null);

  const handleView = (doc: HorseDocumentRow) => {
    setViewingDoc(doc);
  };

  const handleDelete = (id: string) => {
    if (confirmingDelete !== id) {
      setConfirmingDelete(id);
      // Auto-disarm after 4s so the red button doesn't stay forever.
      setTimeout(() => {
        setConfirmingDelete((cur) => (cur === id ? null : cur));
      }, 4000);
      return;
    }
    setConfirmingDelete(null);
    setDeleteError(null);
    startTransition(async () => {
      const res = await deleteHorseDocumentAction(id);
      if (res.error) {
        setDeleteError(`Delete failed: ${res.error}`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div>
      {/* Top row: scan button + expiration banner */}
      <div
        className="flex flex-wrap items-center gap-3 mb-4"
        style={{
          padding: "12px 16px",
          background: "white",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 12,
        }}
      >
        <div className="flex-1 min-w-0">
          <div className="font-serif text-base font-semibold text-barn-dark">
            Paperwork
          </div>
          <div className="text-xs text-barn-dark/60 mt-0.5">
            Agreements, coggins, registration papers — all in one place.
          </div>
        </div>
        {canEdit && (
          <ScanEntryButton
            barnId={barnId}
            horseId={horseId}
            mode="existing_horse"
            label="Scan document"
          />
        )}
      </div>

      {expiring && (
        <div
          className="rounded-2xl px-4 py-3 mb-4 text-sm"
          style={{
            background: "#fef3c7",
            border: "1px solid #fde68a",
            color: "#92400e",
          }}
        >
          <strong>{TYPE_LABELS[expiring.document_type]}</strong> expires{" "}
          {formatDate(expiring.expiration_date!)} — scan a new one to stay
          current.
        </div>
      )}

      {deleteError && (
        <div className="mb-4">
          <ErrorDetails
            title="Couldn't delete document"
            message={deleteError}
            extra={{ "Horse ID": horseId, "Barn ID": barnId }}
          />
        </div>
      )}

      {viewingDoc && (
        <DocumentViewer
          onClose={() => setViewingDoc(null)}
          docId={viewingDoc.id}
          title={viewingDoc.title || viewingDoc.file_name}
          fileName={viewingDoc.file_name}
          mimeType={viewingDoc.mime_type}
        />
      )}

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-barn-dark/10 bg-white p-8 text-center text-sm text-barn-dark/60">
          No documents yet.
          {canEdit
            ? " Tap Scan document to photograph a coggins test, registration paper, or any other horse paperwork."
            : " Ask a barn owner or manager to add documents."}
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => (
            <DocCard
              key={d.id}
              doc={d}
              canEdit={canEdit}
              busy={busy}
              confirmingDelete={confirmingDelete === d.id}
              onView={() => handleView(d)}
              onDelete={() => handleDelete(d.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocCard({
  doc,
  canEdit,
  busy,
  confirmingDelete,
  onView,
  onDelete,
}: {
  doc: HorseDocumentRow;
  canEdit: boolean;
  busy: boolean;
  confirmingDelete: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const expired = doc.expiration_date && doc.expiration_date < today;
  const expiringSoon =
    !expired &&
    doc.expiration_date &&
    (() => {
      const diff =
        (new Date(doc.expiration_date).getTime() -
          new Date(today).getTime()) /
        (1000 * 60 * 60 * 24);
      return diff <= 30;
    })();

  return (
    <div
      className="rounded-2xl border border-barn-dark/10 bg-white px-4 py-3 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
            style={{ background: "rgba(139,74,43,0.08)", color: "#8b4a2b" }}
          >
            {TYPE_LABELS[doc.document_type]}
          </span>
          <span className="font-medium text-barn-dark truncate">
            {doc.title || doc.file_name}
          </span>
          {expired && <ExpirationChip kind="expired" />}
          {expiringSoon && <ExpirationChip kind="soon" />}
          {doc.scan_confidence === "low" && (
            <span
              className="text-[10px] font-mono uppercase px-2 py-0.5 rounded"
              style={{
                background: "#fef3c7",
                color: "#92400e",
                letterSpacing: "0.06em",
              }}
              title="Low-confidence extraction — verify fields"
            >
              Verify
            </span>
          )}
        </div>
        <div className="text-xs text-barn-dark/60 mt-0.5 truncate">
          {doc.file_name} · {(doc.file_size_bytes / 1024).toFixed(0)} KB
          {doc.document_date && (
            <> · Dated {formatDate(doc.document_date)}</>
          )}
          {doc.expiration_date && (
            <> · Expires {formatDate(doc.expiration_date)}</>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onView}
        disabled={busy}
        className="rounded-lg border border-barn-dark/15 bg-white px-3 py-1.5 text-xs font-medium text-barn-dark hover:bg-parchment disabled:opacity-40"
      >
        View
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className={
            confirmingDelete
              ? "rounded-lg bg-[#b8421f] px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-40"
              : "text-xs text-barn-dark/60 hover:text-[#b8421f] disabled:opacity-40"
          }
        >
          {confirmingDelete ? "Tap to confirm" : "Delete"}
        </button>
      )}
    </div>
  );
}

function ExpirationChip({ kind }: { kind: "expired" | "soon" }) {
  const colors =
    kind === "expired"
      ? { bg: "#fee2e2", fg: "#991b1b", label: "Expired" }
      : { bg: "#fef3c7", fg: "#92400e", label: "Expires soon" };
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono uppercase"
      style={{
        background: colors.bg,
        color: colors.fg,
        letterSpacing: "0.06em",
      }}
    >
      {colors.label}
    </span>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}
