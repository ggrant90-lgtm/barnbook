"use client";

import { useState, useCallback } from "react";

interface LineItem {
  description: string;
  amount: string;
}

const inputClass =
  "w-full rounded-xl border border-barn-dark/15 bg-white px-4 py-3 text-barn-dark outline-none focus:border-brass-gold focus:ring-2 focus:ring-brass-gold/25";

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CostInput() {
  const [totalCost, setTotalCost] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const lineItemTotal = lineItems.reduce((sum, item) => {
    const amt = parseFloat(item.amount);
    return sum + (Number.isNaN(amt) ? 0 : amt);
  }, 0);

  const hasLineItems = lineItems.length > 0 && lineItems.some((li) => li.amount !== "");

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [...prev, { description: "", amount: "" }]);
  }, []);

  const removeLineItem = useCallback((index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateLineItem = useCallback(
    (index: number, field: "description" | "amount", value: string) => {
      setLineItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
      );
    },
    [],
  );

  const effectiveTotal = hasLineItems ? lineItemTotal : parseFloat(totalCost) || 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm text-barn-dark/75">Cost (optional)</label>
        <button
          type="button"
          onClick={() => {
            setShowBreakdown(!showBreakdown);
            if (!showBreakdown && lineItems.length === 0) {
              addLineItem();
            }
          }}
          className="text-xs text-brass-gold hover:text-brass-gold/80 transition font-medium"
        >
          {showBreakdown ? "Hide breakdown" : "Break it down →"}
        </button>
      </div>

      {/* Total cost input */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-barn-dark/40 text-sm">
          $
        </span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          className={`${inputClass} pl-8 ${hasLineItems ? "bg-parchment text-barn-dark/60" : ""}`}
          value={hasLineItems ? lineItemTotal.toFixed(2) : totalCost}
          onChange={(e) => {
            if (!hasLineItems) setTotalCost(e.target.value);
          }}
          readOnly={hasLineItems}
        />
        {hasLineItems && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-barn-dark/40">
            from line items
          </span>
        )}
      </div>

      {/* Hidden input for form submission */}
      {effectiveTotal > 0 && (
        <input type="hidden" name="total_cost" value={effectiveTotal.toFixed(2)} />
      )}

      {/* Line items breakdown */}
      {showBreakdown && (
        <div className="space-y-2 rounded-xl border border-barn-dark/10 bg-parchment/50 p-3">
          {lineItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Description"
                className="flex-1 rounded-lg border border-barn-dark/10 bg-white px-3 py-2 text-sm text-barn-dark outline-none focus:border-brass-gold"
                value={item.description}
                onChange={(e) => updateLineItem(i, "description", e.target.value)}
              />
              <div className="relative w-28 flex-shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-barn-dark/40 text-xs">
                  $
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full rounded-lg border border-barn-dark/10 bg-white px-3 py-2 pl-6 text-right text-sm text-barn-dark outline-none focus:border-brass-gold"
                  value={item.amount}
                  onChange={(e) => updateLineItem(i, "amount", e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeLineItem(i)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-barn-dark/30 hover:bg-red-50 hover:text-red-500 transition"
              >
                ✕
              </button>

              {/* Hidden inputs for form submission */}
              <input type="hidden" name={`line_item_desc_${i}`} value={item.description} />
              <input type="hidden" name={`line_item_amt_${i}`} value={item.amount} />
            </div>
          ))}

          <button
            type="button"
            onClick={addLineItem}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-barn-dark/15 py-2 text-xs text-barn-dark/50 hover:border-brass-gold hover:text-barn-dark transition"
          >
            <span className="text-base leading-none">+</span> Add line item
          </button>

          {lineItems.length > 1 && hasLineItems && (
            <div className="flex justify-end border-t border-barn-dark/10 pt-2">
              <span className="text-sm font-medium text-barn-dark">
                Total: {formatCurrency(lineItemTotal)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
