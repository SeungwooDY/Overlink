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

const FREE_MONTHLY_LIMIT = 3;

async function getUser(request: Request) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await supabaseAnon.auth.getUser(token);
  return user;
}

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("meetings")
    .select(`
      id, title, meet_room_code, created_at, updated_at,
      folder_id,
      folders ( name ),
      saved_items ( id, type )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meetings = (data ?? []).map((m: any) => ({
    id: m.id,
    title: m.title,
    meet_room_code: m.meet_room_code,
    created_at: m.created_at,
    updated_at: m.updated_at,
    folder_id: m.folder_id,
    folder_name: (Array.isArray(m.folders) ? m.folders[0]?.name : m.folders?.name) ?? null,
    item_count: m.saved_items?.length ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item_types: [...new Set((m.saved_items ?? []).map((i: any) => i.type as string))],
  }));

  return NextResponse.json(meetings);
}

export async function POST(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check plan — free users limited to 3 meetings/month
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .single();

  const isPro = sub?.plan === "pro" && sub?.status === "active";

  if (!isPro) {
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", periodStart.toISOString());

    if ((count ?? 0) >= FREE_MONTHLY_LIMIT) {
      return NextResponse.json({ error: "limit_reached" }, { status: 403 });
    }
  }

  const { title, meet_room_code } = await request.json();
  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("meetings")
    .insert({ user_id: user.id, title: title.trim(), meet_room_code: meet_room_code ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
