"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BusinessProChrome } from "@/components/business-pro/BusinessProChrome";
import { ClientForm, type ClientFormValues } from "../../ClientForm";
import { updateClientAction } from "@/app/(protected)/actions/clients";

interface ClientRow {
  id: string;
  barn_id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal: string | null;
  address_country: string | null;
  notes: string | null;
}

export function EditClientClient({
  client,
  barns,
}: {
  client: ClientRow;
  barns: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleSubmit = (values: ClientFormValues) => {
    startTransition(async () => {
      const res = await updateClientAction(client.id, {
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
      router.push(`/business-pro/clients/${client.id}`);
    });
  };

  const breadcrumb = [
    { label: "Business Pro", href: "/business-pro" },
    { label: "Clients", href: "/business-pro/clients" },
    {
      label: client.display_name,
      href: `/business-pro/clients/${client.id}`,
    },
    { label: "Edit" },
  ];

  const initial: Partial<ClientFormValues> = {
    barnId: client.barn_id,
    display_name: client.display_name,
    email: client.email ?? "",
    phone: client.phone ?? "",
    address_line1: client.address_line1 ?? "",
    address_line2: client.address_line2 ?? "",
    address_city: client.address_city ?? "",
    address_state: client.address_state ?? "",
    address_postal: client.address_postal ?? "",
    address_country: client.address_country ?? "US",
    notes: client.notes ?? "",
  };

  return (
    <BusinessProChrome breadcrumb={breadcrumb}>
      <div className="bp-page-header">
        <h1 className="bp-display" style={{ fontSize: 32 }}>
          Edit Client
        </h1>
      </div>
      <div style={{ padding: "0 32px 48px" }}>
        <ClientForm
          barns={barns}
          initial={initial}
          submitLabel="Save Changes"
          pending={pending}
          lockBarn
          onSubmit={handleSubmit}
        />
      </div>
    </BusinessProChrome>
  );
}
