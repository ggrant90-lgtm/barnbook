"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { ExpenseForm, type ExpenseFormValues } from "../ExpenseForm";
import {
  updateBarnExpenseAction,
  deleteBarnExpenseAction,
} from "@/app/(protected)/actions/barn-expenses";
import type { PaymentMethod } from "@/lib/business-pro-constants";

interface Expense {
  id: string;
  barn_id: string;
  performed_at: string;
  category: string;
  vendor_name: string | null;
  description: string | null;
  notes: string | null;
  total_cost: number;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  payment_status: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  created_at: string;
}

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Expenses", href: "/business-pro/expenses" },
  { label: "Edit" },
];

export function ExpenseDetailClient({
  expense,
  barns,
  customCategories,
}: {
  expense: Expense;
  barns: { id: string; name: string }[];
  customCategories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSave = (values: ExpenseFormValues) => {
    startTransition(async () => {
      const res = await updateBarnExpenseAction(expense.id, {
        barnId: values.barnId,
        performed_at: new Date(values.performed_at).toISOString(),
        category: values.category,
        total_cost: values.total_cost,
        vendor_name: values.vendor_name || null,
        description: values.description || null,
        notes: values.notes || null,
        payment_method: values.payment_method || null,
        payment_reference: values.payment_reference || null,
      });
      if (res.error) {
        alert(`Failed: ${res.error}`);
        return;
      }
      router.push("/business-pro/expenses");
    });
  };

  const handleDelete = () => {
    if (
      !confirm(
        "Delete this expense? This cannot be undone and it will be removed from all reports.",
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteBarnExpenseAction(expense.id);
      if (res.error) {
        alert(`Failed: ${res.error}`);
        return;
      }
      router.push("/business-pro/expenses");
    });
  };

  const initial: Partial<ExpenseFormValues> = {
    barnId: expense.barn_id,
    performed_at: new Date(expense.performed_at).toISOString().slice(0, 10),
    category: expense.category,
    total_cost: expense.total_cost,
    vendor_name: expense.vendor_name ?? "",
    description: expense.description ?? "",
    notes: expense.notes ?? "",
    payment_method: expense.payment_method ?? "",
    payment_reference: expense.payment_reference ?? "",
  };

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Edit Expense
        </h1>
        <p
          style={{
            color: "var(--bp-ink-secondary)",
            fontSize: 12,
            marginTop: 4,
          }}
        >
          Created{" "}
          {new Date(expense.created_at).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
      <div style={{ padding: "0 32px 48px" }}>
        <ExpenseForm
          barns={barns}
          customCategories={customCategories}
          initial={initial}
          submitLabel="Save Changes"
          pending={pending}
          onSubmit={handleSave}
        />

        <div style={{ marginTop: 24, maxWidth: 720 }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-sm text-[#b8421f] hover:underline disabled:opacity-40"
          >
            Delete this expense
          </button>
        </div>
      </div>
    </BusinessProChrome>
  );
}
