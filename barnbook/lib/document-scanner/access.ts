import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plan tiers that *used to* grant automatic document-scanner access.
 * Kept as an exported constant so any admin logic that wants to
 * re-gate the scanner in the future can reuse the same vocabulary,
 * but no runtime check currently references it — the scanner is
 * open to every authenticated user.
 */
export const PAID_BARN_TIERS = ["paid", "comped"] as const;

/**
 * Document scanner access is currently open to every signed-in user.
 *
 * Historically this checked `profiles.has_document_scanner` plus
 * `barn.plan_tier IN (paid, comped)`. Those signals are preserved in
 * the schema + admin UI for potential future re-gating, but the
 * runtime check now returns `true` unconditionally. The parameters
 * remain so every call site keeps working without a rewrite, and so
 * that re-enabling the gate is a one-function change.
 */
export async function canUserUseDocumentScanner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  _supabase: SupabaseClient<any>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _barnId: string | null,
): Promise<boolean> {
  return true;
}

/**
 * Paired with canUserUseDocumentScanner — used on pages without a
 * specific barn in context. Same policy: open to every signed-in
 * user.
 */
export async function userHasAnyScannerAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  _supabase: SupabaseClient<any>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userId: string,
): Promise<boolean> {
  return true;
}
