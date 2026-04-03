"use server";

import { createServerComponentClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createBarnAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }


  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const zip = String(formData.get("zip") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!name) {
    return { error: "Barn name is required." };
  }

  const { data: barn, error: barnErr } = await supabase
    .from("barns")
    .insert({
      name,
      owner_id: user.id,
      address,
      city,
      state,
      zip,
      phone,
    })
    .select("id")
    .single();

  if (barnErr || !barn) {
    return { error: barnErr?.message ?? "Could not create barn." };
  }

  const { error: memErr } = await supabase.from("barn_members").insert({
    barn_id: barn.id,
    user_id: user.id,
    role: "owner",
  });

  if (memErr) {
    return { error: memErr.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
