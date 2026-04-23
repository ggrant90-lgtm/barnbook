import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, message, plan_requested } = body as {
      email?: string;
      message?: string | null;
      plan_requested?: string;
    };

    if (!email || !plan_requested) {
      return NextResponse.json(
        { error: "email and plan_requested are required" },
        { status: 400 },
      );
    }

    const supabase = await createServerComponentClient();

    // Check if the user is logged in
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("paywall_interest").insert({
      user_id: user?.id ?? null,
      plan_requested,
      email: email.trim(),
      message: message?.trim() || null,
    });

    if (error) {
      console.error("paywall_interest insert error:", error);
      return NextResponse.json(
        { error: "Failed to save interest" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("capture-interest error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
