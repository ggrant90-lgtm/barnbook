import { redirect } from "next/navigation";

/**
 * Canonical URL for the Scan feature. Redirects to /identify — which is the
 * actual page — to preserve back-compat with existing QR codes in the wild
 * that link to /identify.
 */
export default function ScanAliasPage() {
  redirect("/identify");
}
