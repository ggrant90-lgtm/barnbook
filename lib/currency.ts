export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null || amount === 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyOrDash(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return formatCurrency(amount) || "$0.00";
}
