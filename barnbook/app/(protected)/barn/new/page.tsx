import { createServerComponentClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { NewBarnClient } from "./NewBarnClient";

export default async function NewBarnPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Check if user already has a free barn
  const { count } = await supabase
    .from("barns")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("plan_tier", "free");

  const hasFreeBarn = (count ?? 0) > 0;

  return <NewBarnClient hasFreeBarn={hasFreeBarn} />;
}
