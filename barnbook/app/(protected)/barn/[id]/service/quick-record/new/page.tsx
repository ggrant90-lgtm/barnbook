import { notFound, redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase-server";
import type { Barn } from "@/lib/types";
import { NewQuickRecordForm } from "./NewQuickRecordForm";

export default async function NewQuickRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: barnId } = await params;
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: barn } = await supabase
    .from("barns")
    .select("*")
    .eq("id", barnId)
    .maybeSingle();
  if (!barn) notFound();
  if ((barn as Barn).owner_id !== user.id) redirect(`/barn/${barnId}`);
  if ((barn as Barn).barn_type !== "service") redirect(`/barn/${barnId}`);

  return <NewQuickRecordForm barn={barn as Barn} />;
}
