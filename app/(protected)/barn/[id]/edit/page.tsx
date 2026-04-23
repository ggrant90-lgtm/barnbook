import { canManageBarnKeys } from "@/lib/key-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { getBarnCapacitySnapshot } from "@/lib/plans.server";
import type { Barn, BarnPhoto } from "@/lib/types";
import { redirect } from "next/navigation";
import { BarnEditClient } from "./BarnEditClient";

export default async function BarnEditPage({
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

  const { data: barn } = await supabase
    .from("barns")
    .select("*")
    .eq("id", id)
    .single();

  if (!barn) redirect("/dashboard");

  const canManage = await canManageBarnKeys(supabase, user.id, id);
  if (!canManage) redirect(`/barn/${id}`);

  const [{ data: photos }, snapshot] = await Promise.all([
    supabase
      .from("barn_photos")
      .select("*")
      .eq("barn_id", id)
      .order("sort_order", { ascending: true }),
    getBarnCapacitySnapshot(supabase, id),
  ]);

  return (
    <BarnEditClient
      barn={barn as Barn}
      photos={(photos ?? []) as BarnPhoto[]}
      capacity={
        snapshot
          ? {
              baseStalls: snapshot.baseStalls,
              blockCount: snapshot.blockCount,
              blockCapacity: snapshot.blockCapacity,
              effectiveCapacity: snapshot.effectiveCapacity,
              horseCount: snapshot.horseCount,
            }
          : null
      }
    />
  );
}
