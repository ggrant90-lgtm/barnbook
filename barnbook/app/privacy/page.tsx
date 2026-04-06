import { readFileSync } from "fs";
import { join } from "path";
import type { Metadata } from "next";
import { PRIVACY_VERSION } from "@/lib/legal-versions";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — BarnBook",
  description:
    "Privacy Policy for BarnBook, explaining how we collect, use, and protect your information.",
};

export default function PrivacyPage() {
  const content = readFileSync(
    join(process.cwd(), "content", "legal", "privacy.md"),
    "utf-8",
  );

  return <LegalPage content={content} version={PRIVACY_VERSION} />;
}
