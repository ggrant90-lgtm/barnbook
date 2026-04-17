"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { ClientForm, type ClientFormValues } from "../ClientForm";
import { createClientAction } from "@/app/(protected)/actions/clients";

const breadcrumb = [
  { label: "Business Pro", href: "/business-pro" },
  { label: "Clients", href: "/business-pro/clients" },
  { label: "New" },
];

export function NewClientClient({
  barns,
}: {
  barns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSubmit = (values: ClientFormValues) => {
    startTransition(async () => {
      const res = await createClientAction({
        barnId: values.barnId,
        display_name: values.display_name,
        email: values.email || null,
        phone: values.phone || null,
        address_line1: values.address_line1 || null,
        address_line2: values.address_line2 || null,
        address_city: values.address_city || null,
        address_state: values.address_state || null,
        address_postal: values.address_postal || null,
        address_country: values.address_country || "US",
        notes: values.notes || null,
      });
      if (res.error) {
        alert(`Failed: ${res.error}`);
        return;
      }
      if (res.clientId) {
        router.push(`/business-pro/clients/${res.clientId}`);
      } else {
        router.push("/business-pro/clients");
      }
    });
  };

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          New Client
        </h1>
      </div>
      <div style={{ padding: "0 32px 48px" }}>
        <ClientForm
          barns={barns}
          submitLabel="Create Client"
          pending={pending}
          onSubmit={handleSubmit}
        />
      </div>
    </BusinessProChrome>
  );
}
