import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import { NewClientClient } from "./NewClientClient";

export default async function NewClientPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: ownedBarns } = await supabase
    .from("barns")
    .select("id, name")
    .eq("owner_id", user.id);
  const barns = (ownedBarns ?? []) as { id: string; name: string }[];
  if (barns.length === 0) redirect("/business-pro/clients");

  return <NewClientClient barns={barns} />;
}
