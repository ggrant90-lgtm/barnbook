/**
 * Business Pro — shared constants for financial tracking.
 */

export const COST_TYPES = ["revenue", "expense", "pass_through"] as const;
export type CostType = (typeof COST_TYPES)[number];

export const COST_TYPE_LABELS: Record<CostType, string> = {
  revenue: "Revenue",
  expense: "Expense",
  pass_through: "Pass-through",
};

export const COST_TYPE_ICONS: Record<CostType, string> = {
  revenue: "\ud83d\udcb0", // 💰
  expense: "\ud83d\udce4", // 📤
  pass_through: "\ud83d\udd04", // 🔄
};

export const COST_TYPE_COLORS: Record<CostType, string> = {
  revenue: "#2a4031", // forest green
  expense: "#8b4a2b", // saddle brown
  pass_through: "#c9a84c", // brass gold
};

export const PAYMENT_STATUSES = ["unpaid", "paid", "partial", "waived"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  partial: "Partial",
  waived: "Waived",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  unpaid: "#d97706", // amber (warning)
  paid: "#2a4031", // muted green
  partial: "#c9a84c", // brass gold
  waived: "#6b7280", // gray
};

/**
 * Smart default cost_type by log type. Users can always override.
 * Keep null for types with no default financial component (notes).
 */
export const DEFAULT_COST_TYPE: Record<string, CostType | null> = {
  exercise: "revenue",
  feed: "expense",
  medication: "pass_through",
  note: null,
  breed_data: "expense",
  shoeing: "pass_through",
  worming: "pass_through",
  vet_visit: "pass_through",
};

/** Aging thresholds for accounts receivable */
export const AR_AGING_DAYS = {
  current: 30, // < 30d = green
  aging: 60, // 30-60d = amber
  // > 60d = red
} as const;
