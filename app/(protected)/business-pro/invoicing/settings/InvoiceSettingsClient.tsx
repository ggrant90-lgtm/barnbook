"use client";

import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { uploadBarnLogo } from "@/lib/barn-logo";
import { updateBarnInvoiceSettingsAction } from "@/app/(protected)/actions/invoices";

interface BarnSettings {
  id: string;
  name: string;
  logo_url: string | null;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  invoice_notes_default: string | null;
  invoice_terms_default: string | null;
}

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Invoicing", href: "/business-pro/invoicing" },
  { label: "Settings" },
];

export function InvoiceSettingsClient({ barns }: { barns: BarnSettings[] }) {
  const [activeBarnId, setActiveBarnId] = useState(barns[0].id);
  const [barnState, setBarnState] = useState<Record<string, BarnSettings>>(
    Object.fromEntries(barns.map((b) => [b.id, b])),
  );
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const current = barnState[activeBarnId];

  const update = (field: keyof BarnSettings, value: string | null) => {
    setBarnState((prev) => ({
      ...prev,
      [activeBarnId]: { ...prev[activeBarnId], [field]: value },
    }));
  };

  const handleLogoUpload = async (file: File) => {
    setUploading(true);
    const res = await uploadBarnLogo(activeBarnId, file);
    setUploading(false);
    if ("error" in res) {
      alert(res.error);
      return;
    }
    update("logo_url", res.publicUrl);
    // Save the logo_url immediately
    startTransition(async () => {
      await updateBarnInvoiceSettingsAction(activeBarnId, { logo_url: res.publicUrl });
    });
  };

  const handleSave = () => {
    setSaving(true);
    setSaved(false);
    startTransition(async () => {
      const res = await updateBarnInvoiceSettingsAction(activeBarnId, {
        company_name: current.company_name?.trim() || null,
        company_address: current.company_address?.trim() || null,
        company_phone: current.company_phone?.trim() || null,
        company_email: current.company_email?.trim() || null,
        invoice_notes_default: current.invoice_notes_default?.trim() || null,
        invoice_terms_default: current.invoice_terms_default?.trim() || null,
      });
      setSaving(false);
      if (res.error) {
        alert(res.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  };

  const handleRemoveLogo = () => {
    if (!confirm("Remove the logo?")) return;
    update("logo_url", null);
    startTransition(async () => {
      await updateBarnInvoiceSettingsAction(activeBarnId, { logo_url: null });
    });
  };

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>Invoice Settings</h1>
        <p style={{ color: "var(--bp-ink-secondary)", fontSize: 13, marginTop: 6 }}>
          Customize the branding and defaults for invoices. Applied per barn.
        </p>
      </div>

      <div style={{ padding: "0 32px 48px", maxWidth: 760 }}>
        {/* Barn switcher */}
        {barns.length > 1 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
            {barns.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveBarnId(b.id)}
                className={`bp-chip ${activeBarnId === b.id ? "bp-active" : ""}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        )}

        {/* Logo */}
        <fieldset className="bp-fieldset">
          <legend className="bp-fieldset-legend">Logo</legend>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                width: 140,
                height: 100,
                border: "1px dashed var(--bp-border)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bp-bg)",
                overflow: "hidden",
              }}
            >
              {current.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={current.logo_url}
                  alt="Logo"
                  style={{ maxHeight: 90, maxWidth: 130, objectFit: "contain" }}
                />
              ) : (
                <span style={{ fontSize: 11, color: "var(--bp-ink-tertiary)" }}>No logo</span>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoUpload(f);
                }}
                style={{ display: "none" }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bp-btn"
                disabled={uploading}
              >
                {uploading ? "Uploading..." : current.logo_url ? "Replace Logo" : "Upload Logo"}
              </button>
              {current.logo_url && (
                <button type="button" onClick={handleRemoveLogo} className="bp-btn" style={{ color: "#b91c1c" }}>
                  Remove
                </button>
              )}
              <div style={{ fontSize: 11, color: "var(--bp-ink-tertiary)" }}>
                JPEG, PNG, WebP, or SVG · max 2MB
              </div>
            </div>
          </div>
        </fieldset>

        {/* Company info */}
        <fieldset className="bp-fieldset">
          <legend className="bp-fieldset-legend">Company Info</legend>
          <div>
            <label className="bp-label">Business Name</label>
            <input
              type="text"
              value={current.company_name ?? ""}
              onChange={(e) => update("company_name", e.target.value)}
              placeholder={current.name}
              className="bp-input"
            />
            <p style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 4 }}>
              Defaults to barn name if left blank.
            </p>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="bp-label">Address</label>
            <textarea
              value={current.company_address ?? ""}
              onChange={(e) => update("company_address", e.target.value)}
              rows={3}
              placeholder="123 Main St&#10;Anywhere, TX 75001"
              className="bp-input"
              style={{ resize: "vertical" }}
            />
          </div>
          <div className="bp-field-row" style={{ marginTop: 12 }}>
            <div>
              <label className="bp-label">Phone</label>
              <input
                type="tel"
                value={current.company_phone ?? ""}
                onChange={(e) => update("company_phone", e.target.value)}
                placeholder="(555) 123-4567"
                className="bp-input"
              />
            </div>
            <div>
              <label className="bp-label">Email</label>
              <input
                type="email"
                value={current.company_email ?? ""}
                onChange={(e) => update("company_email", e.target.value)}
                placeholder="billing@yourbarn.com"
                className="bp-input"
              />
            </div>
          </div>
        </fieldset>

        {/* Defaults */}
        <fieldset className="bp-fieldset">
          <legend className="bp-fieldset-legend">Invoice Defaults</legend>
          <div>
            <label className="bp-label">Default Notes</label>
            <textarea
              value={current.invoice_notes_default ?? ""}
              onChange={(e) => update("invoice_notes_default", e.target.value)}
              rows={3}
              placeholder="Thank you for your business!"
              className="bp-input"
              style={{ resize: "vertical" }}
            />
            <p style={{ fontSize: 11, color: "var(--bp-ink-tertiary)", marginTop: 4 }}>
              Pre-filled on new invoices (can be edited per invoice).
            </p>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="bp-label">Default Terms</label>
            <textarea
              value={current.invoice_terms_default ?? ""}
              onChange={(e) => update("invoice_terms_default", e.target.value)}
              rows={3}
              placeholder="Payment due within 30 days. Please make checks payable to..."
              className="bp-input"
              style={{ resize: "vertical" }}
            />
          </div>
        </fieldset>

        {/* Save */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bp-btn bp-primary"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && (
            <span style={{ fontSize: 12, color: "#166534", fontWeight: 500 }}>
              ✓ Saved
            </span>
          )}
          <Link href="/business-pro/invoicing" className="bp-btn">
            Back to Invoices
          </Link>
        </div>
      </div>
    </BusinessProChrome>
  );
}
