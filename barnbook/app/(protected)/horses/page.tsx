import { getPrimaryBarnContext } from "@/lib/barn-session";
import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Horse } from "@/lib/types";
import { redirect } from "next/navigation";
import { HorsesGrid } from "./HorsesGrid";

export default async function HorsesPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getPrimaryBarnContext(supabase, user.id);
  if (!ctx) redirect("/dashboard");

  const { data: horsesRaw, error } = await supabase
    .from("horses")
    .select("*")
    .eq("barn_id", ctx.barn.id)
    .order("name", { ascending: true });

  if (error) {
    return (
      <div className="px-4 py-10 text-barn-red">
        Could not load horses: {error.message}
      </div>
    );
  }

  const horses = (horsesRaw ?? []) as Horse[];
  const canAdd = await canUserEditHorse(supabase, user.id, ctx.barn.id);

  return <HorsesGrid horses={horses} canAdd={canAdd} />;
}
