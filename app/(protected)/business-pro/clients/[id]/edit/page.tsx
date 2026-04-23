import { redirect, notFound } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { EditClientClient } from "./EditClientClient";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: client } = await (supabase as any)
    .from("barn_clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!client) notFound();

  const { data: barn } = await supabase
    .from("barns")
    .select("id, owner_id")
    .eq("id", client.barn_id)
    .maybeSingle();
  if (!barn || barn.owner_id !== user.id) {
    redirect("/business-pro/clients");
  }

  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name")
    .eq("owner_id", user.id);
  const barns = (ownedBarns ?? []) as { id: string; name: string }[];

  return <EditClientClient client={client} barns={barns} />;
}
