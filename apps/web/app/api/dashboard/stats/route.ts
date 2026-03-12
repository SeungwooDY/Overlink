import { NextResponse } from "next/server";
import { getUser, supabase } from "@/lib/api/auth";

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("saved_items")
    .select("type")
    .eq("user_id", user.id);

  const counts: Record<string, number> = {
    url: 0, qr_code: 0, email: 0, phone: 0, event: 0, contact: 0,
  };
  for (const row of data ?? []) {
    if (row.type in counts) counts[row.type]++;
  }

  return NextResponse.json(counts);
}
