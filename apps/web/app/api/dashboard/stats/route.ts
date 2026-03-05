import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
