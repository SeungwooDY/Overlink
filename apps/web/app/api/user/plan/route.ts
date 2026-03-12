import { NextResponse } from "next/server";
import { getUser, supabase } from "@/lib/api/auth";

export async function GET(request: Request) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .single();

  const plan = sub?.plan === "pro" && sub?.status === "active" ? "pro" : "free";
  return NextResponse.json({ plan });
}
