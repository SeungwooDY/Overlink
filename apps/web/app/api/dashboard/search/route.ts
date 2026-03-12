import { NextResponse } from "next/server";
import { getUser, supabase } from "@/lib/api/auth";

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json([]);

  const pattern = `%${q}%`;

  // Search meeting titles
  const { data: meetingMatches } = await supabase
    .from("meetings")
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .ilike("title", pattern)
    .order("created_at", { ascending: false })
    .limit(25);

  // Search saved_items (value, title, name, email fields in data jsonb)
  const { data: itemMatches } = await supabase
    .from("saved_items")
    .select(`
      id, type, data, created_at,
      meetings ( id, title )
    `)
    .eq("user_id", user.id)
    .or(
      `data->>'value'.ilike.${pattern},data->>'title'.ilike.${pattern},data->>'name'.ilike.${pattern},data->>'email'.ilike.${pattern}`
    )
    .order("created_at", { ascending: false })
    .limit(25);

  type SearchResult = {
    type: "meeting" | "item";
    id: string;
    label: string;
    meeting_title: string | null;
    meeting_id: string | null;
    created_at: string;
    item_type?: string;
  };

  const results: SearchResult[] = [];

  for (const m of meetingMatches ?? []) {
    results.push({
      type: "meeting",
      id: m.id,
      label: m.title,
      meeting_title: m.title,
      meeting_id: m.id,
      created_at: m.created_at,
    });
  }

  for (const item of itemMatches ?? []) {
    const d = item.data as Record<string, string>;
    const label = d.value ?? d.title ?? d.name ?? d.email ?? item.type;
    const meetingRaw = item.meetings;
    const meeting = Array.isArray(meetingRaw)
      ? (meetingRaw[0] as { id: string; title: string } | null)
      : (meetingRaw as { id: string; title: string } | null);
    results.push({
      type: "item",
      id: item.id,
      label,
      meeting_title: meeting?.title ?? null,
      meeting_id: meeting?.id ?? null,
      created_at: item.created_at,
      item_type: item.type,
    });
  }

  // Sort by date desc and cap at 50
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return NextResponse.json(results.slice(0, 50));
}
