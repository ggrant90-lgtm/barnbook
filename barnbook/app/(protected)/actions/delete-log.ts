"use server";

import { canUserEditHorse } from "@/lib/horse-access";
import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

export async function deleteLogAction(
  logId: string,
  logType: "activity" | "health",
  horseId: string,
): Promise<{ error?: string }> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify horse exists and user has edit permission
  const { data: horse } = await supabase
    .from("horses")
    .select("barn_id")
    .eq("id", horseId)
    .single();

  if (!horse) return { error: "Horse not found" };

  const canEdit = await canUserEditHorse(supabase, user.id, horse.barn_id);
  if (!canEdit) return { error: "No permission to delete this log entry" };

  // Delete related records first (line items, media)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("log_entry_line_items")
    .delete()
    .eq("log_type", logType)
    .eq("log_id", logId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("log_media")
    .delete()
    .eq("log_type", logType)
    .eq("log_id", logId);

  // Delete the log entry itself
  const table = logType === "activity" ? "activity_log" : "health_records";
  const { error } = await supabase.from(table).delete().eq("id", logId);

  if (error) return { error: error.message };

  revalidatePath(`/horses/${horseId}`);
  return {};
}
