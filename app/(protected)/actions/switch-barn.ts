"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function switchBarnAction(barnId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set("active_barn_id", barnId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
