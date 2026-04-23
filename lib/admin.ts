import { createServerComponentClient } from "./supabase-server";

/**
 * Check if the current user is a platform admin.
 * Server-side only. Never expose this result to client components.
 */
export async function isUserAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerComponentClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .single();

    return profile?.is_platform_admin === true;
  } catch {
    return false;
  }
}

/**
 * Get the current admin user ID, or null if not admin.
 */
export async function getAdminUserId(): Promise<string | null> {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_platform_admin === true ? user.id : null;
}
