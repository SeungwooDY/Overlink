import { NextResponse } from "next/server";
import { getUser, supabase } from "@/lib/api/auth";

const VALID_TYPES = ["url", "qr_code", "email", "phone", "event", "contact"];

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_items")
    .select("id, type, data, created_at, meeting_id, meetings ( title )")
    .eq("user_id", user.id)
    .eq("type", type)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (data ?? []).map((item: any) => ({
    id: item.id,
    type: item.type,
    data: item.data,
    created_at: item.created_at,
    meeting_id: item.meeting_id,
    meeting_title: (Array.isArray(item.meetings) ? item.meetings[0]?.title : item.meetings?.title) ?? null,
  }));

  return NextResponse.json(items);
}
