"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { ExpenseForm, type ExpenseFormValues } from "../ExpenseForm";
import { createBarnExpenseAction } from "@/app/(protected)/actions/barn-expenses";

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Expenses", href: "/business-pro/expenses" },
  { label: "New" },
];

export function NewExpenseClient({
  barns,
  customCategories,
}: {
  barns: { id: string; name: string }[];
  customCategories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSubmit = (values: ExpenseFormValues) => {
    startTransition(async () => {
      const res = await createBarnExpenseAction({
        barnId: values.barnId,
        performed_at: new Date(values.performed_at).toISOString(),
        category: values.category,
        total_cost: values.total_cost,
        vendor_name: values.vendor_name || null,
        description: values.description || null,
        notes: values.notes || null,
        payment_method: values.payment_method || null,
        payment_reference: values.payment_reference || null,
        payment_status: values.payment_method ? "paid" : null,
        paid_at: values.payment_method ? new Date().toISOString() : null,
        paid_amount: values.payment_method ? values.total_cost : null,
        cost_type: "expense",
      });
      if (res.error) {
        alert(`Failed: ${res.error}`);
        return;
      }
      router.push("/business-pro/expenses");
    });
  };

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          New Expense
        </h1>
      </div>
      <div style={{ padding: "0 32px 48px" }}>
        <ExpenseForm
          barns={barns}
          customCategories={customCategories}
          submitLabel="Create Expense"
          pending={pending}
          onSubmit={handleSubmit}
        />
      </div>
    </BusinessProChrome>
  );
}
