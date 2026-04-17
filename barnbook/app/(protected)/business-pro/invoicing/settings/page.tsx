import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { InvoiceSettingsClient } from "./InvoiceSettingsClient";

export default async function InvoiceSettingsPage() {
  const supabase = await createServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name, logo_url, company_name, company_address, company_phone, company_email, invoice_notes_default, invoice_terms_default")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const barns = (ownedBarns ?? []) as Array<{
    id: string;
    name: string;
    logo_url: string | null;
    company_name: string | null;
    company_address: string | null;
    company_phone: string | null;
    company_email: string | null;
    invoice_notes_default: string | null;
    invoice_terms_default: string | null;
  }>;

  if (barns.length === 0) redirect("/business-pro");

  return <InvoiceSettingsClient barns={barns} />;
}
