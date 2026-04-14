"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Breeders Pro onboarding — create a breeding program (barn) for a
 * new user with zero friction. Just a name, then go.
 *
 * Mirrors createBarnAction but skips address/phone/plan-tier and
 * redirects straight to /breeders-pro instead of /dashboard.
 */
export async function createProgramAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Program name is required." };

  // Create the barn (program container)
  const { data: barn, error: barnErr } = await supabase
    .from("barns")
    .insert({
      name,
      owner_id: user.id,
      barn_type: "standard",
      plan_tier: "free",
      stall_capacity: 999, // Breeders Pro doesn't gate on stall count
      plan_notes: "Breeders Pro program",
      plan_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (barnErr || !barn) {
    return { error: barnErr?.message ?? "Could not create program." };
  }

  // Add user as owner
  const { error: memErr } = await supabase.from("barn_members").insert({
    barn_id: barn.id,
    user_id: user.id,
    role: "owner",
  });

  if (memErr) {
    return { error: memErr.message };
  }

  revalidatePath("/", "layout");
  redirect("/breeders-pro");
}
