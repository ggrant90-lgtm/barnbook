import { readFileSync } from "fs";
import { join } from "path";
import type { Metadata } from "next";
import { TERMS_VERSION } from "@/lib/legal-versions";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — BarnBook",
  description:
    "Terms of Service for BarnBook, a horse management and CRM platform at barnbook.us.",
};

export default function TermsPage() {
  const content = readFileSync(
    join(process.cwd(), "content", "legal", "terms.md"),
    "utf-8",
  );

  return <LegalPage content={content} version={TERMS_VERSION} />;
}
