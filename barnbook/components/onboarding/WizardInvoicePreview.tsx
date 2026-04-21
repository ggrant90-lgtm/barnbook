"use client";

/**
 * Live invoice preview for the Business Pro wizard. Styled like a
 * real invoice — top-of-page company name, bill-to block, itemised
 * lines, total — not like a form. Makes the wizard feel like the user
 * is actually creating a document.
 */
export function WizardInvoicePreview({
  companyName,
  companyEmail,
  companyPhone,
  clientName,
  invoiceNumber,
  lineItems,
}: {
  companyName: string;
  companyEmail: string | null;
  companyPhone: string | null;
  clientName: string;
  invoiceNumber: string;
  lineItems: Array<{ description: string; quantity: number; unitPriceCents: number }>;
}) {
  const subtotalCents = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPriceCents,
    0,
  );
  return (
    <div
      className="rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: "rgba(42,64,49,0.12)", padding: 20 }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div
            className="font-serif text-xl font-semibold"
            style={{ color: "#2a4031" }}
          >
            {companyName.trim() || "Your business"}
          </div>
          {(companyEmail || companyPhone) && (
            <div className="text-xs mt-0.5" style={{ color: "rgba(42,64,49,0.55)" }}>
              {[companyPhone, companyEmail].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        <div className="text-right">
          <div
            className="text-[11px] uppercase tracking-wide font-medium"
            style={{ color: "rgba(42,64,49,0.5)" }}
          >
            Invoice
          </div>
          <div
            className="font-mono text-sm"
            style={{ color: "#2a4031" }}
          >
            {invoiceNumber}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg p-3" style={{ background: "rgba(245,239,228,0.45)" }}>
        <div
          className="text-[11px] uppercase tracking-wide font-medium"
          style={{ color: "rgba(42,64,49,0.5)" }}
        >
          Bill to
        </div>
        <div className="text-sm font-medium" style={{ color: "#2a4031" }}>
          {clientName.trim() || "New client"}
        </div>
      </div>

      <div className="mt-4">
        {lineItems.length === 0 ? (
          <div className="text-sm" style={{ color: "rgba(42,64,49,0.55)" }}>
            Add a line item to see your invoice fill in.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "rgba(42,64,49,0.55)" }}>
                <th align="left" className="pb-1 font-medium text-[11px] uppercase tracking-wide">
                  Description
                </th>
                <th align="right" className="pb-1 font-medium text-[11px] uppercase tracking-wide">
                  Qty
                </th>
                <th align="right" className="pb-1 font-medium text-[11px] uppercase tracking-wide">
                  Price
                </th>
                <th align="right" className="pb-1 font-medium text-[11px] uppercase tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(42,64,49,0.08)" }}>
                  <td className="py-2" style={{ color: "#2a4031" }}>
                    {li.description || "—"}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#2a4031" }}>
                    {li.quantity}
                  </td>
                  <td className="py-2 text-right" style={{ color: "#2a4031" }}>
                    {fmtCents(li.unitPriceCents)}
                  </td>
                  <td className="py-2 text-right font-medium" style={{ color: "#2a4031" }}>
                    {fmtCents(li.quantity * li.unitPriceCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div
        className="mt-4 flex justify-end items-baseline gap-3 pt-3"
        style={{ borderTop: "1px solid rgba(42,64,49,0.08)" }}
      >
        <span className="text-sm" style={{ color: "rgba(42,64,49,0.55)" }}>
          Total
        </span>
        <span className="font-serif text-xl font-semibold" style={{ color: "#2a4031" }}>
          {fmtCents(subtotalCents)}
        </span>
      </div>
    </div>
  );
}

function fmtCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}
