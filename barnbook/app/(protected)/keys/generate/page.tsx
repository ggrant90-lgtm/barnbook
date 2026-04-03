import { getPrimaryBarnContext } from "@/lib/barn-session";
import { canManageBarnKeys } from "@/lib/key-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { GenerateKeyForm } from "./GenerateKeyForm";

export default async function GenerateKeyPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; horse?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const ctx = await getPrimaryBarnContext(supabase, user.id);
  if (!ctx) redirect("/dashboard");

  const canManage = await canManageBarnKeys(supabase, user.id, ctx.barn.id);
  if (!canManage) redirect("/dashboard");

  const { data: horses } = await supabase
    .from("horses")
    .select("id, name")
    .eq("barn_id", ctx.barn.id)
    .order("name", { ascending: true });

  return (
    <GenerateKeyForm
      barnName={ctx.barn.name}
      horses={horses ?? []}
      initialType={sp.type === "stall" ? "stall" : "barn"}
      initialHorseId={sp.horse?.trim() || null}
    />
  );
}
