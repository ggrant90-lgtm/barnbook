import { createPublicSupabaseClient } from "@/lib/supabase-public";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("horses")
    .select("id, name, breed, photo_url")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Horse not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    breed: data.breed,
    photo_url: data.photo_url,
  });
}
