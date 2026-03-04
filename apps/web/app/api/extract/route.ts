import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Anon client — validates Bearer JWTs (requests come from extension, no cookies)
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
// Service-role client — bypasses RLS for usage tracking
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MONTHLY_CAP = 1_000;

export async function POST(request: Request) {
  // 1. Auth
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  // 2. Pro check
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .single();

  if (!sub || sub.plan !== "pro" || sub.status !== "active") {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  // 3. Usage cap
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);

  const { data: usage } = await supabase
    .from("usage")
    .select("calls_used")
    .eq("user_id", userId)
    .eq("period_start", periodStart.toISOString())
    .single();

  if ((usage?.calls_used ?? 0) >= MONTHLY_CAP) {
    return NextResponse.json({ error: "Monthly usage limit reached" }, { status: 429 });
  }

  // 4. Extract text from body
  const { text } = await request.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text field required" }, { status: 400 });
  }

  // 5. Claude extraction
  const systemPrompt = `Extract structured entities from OCR text captured from a screen share.
Return JSON only.

Schema:
{
  "events": [{"title":string,"date":string,"time":string,"timezone":string,"location":string,"description":string}],
  "contacts": [{"name":string,"email":string,"phone":string,"company":string,"role":string}]
}

Rules: only include confident entities, omit unknown fields, use ISO 8601 for dates.
Return {"events":[],"contacts":[]} if nothing found.`;

  let entities: { events: unknown[]; contacts: unknown[] } = { events: [], contacts: [] };

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: `OCR text:\n${text}` }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      entities = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error("[extract] Claude error:", err);
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }

  // 6. Increment usage
  await supabase.from("usage").upsert(
    { user_id: userId, period_start: periodStart.toISOString(), calls_used: (usage?.calls_used ?? 0) + 1 },
    { onConflict: "user_id,period_start" }
  );

  return NextResponse.json(entities);
}
