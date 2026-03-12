import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabase } from "@/lib/api/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  console.log("[webhook] POST received");
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("[webhook] signature verification failed:", (err as Error).message);
    return NextResponse.json({ error: `Webhook error: ${(err as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    console.log("[webhook] checkout.session.completed — userId:", userId, "subscription:", session.subscription);
    if (userId && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      console.log("[webhook] subscription status:", subscription.status);
      const { error: upsertErr } = await supabase.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: subscription.id,
        plan: "pro",
        status: subscription.status,
        current_period_end: (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (upsertErr) console.error("[webhook] upsert error:", upsertErr.message);
      else console.log("[webhook] subscription updated to pro for user:", userId);
    } else {
      console.warn("[webhook] missing userId or subscription field");
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    await supabase
      .from("subscriptions")
      .update({
        plan: subscription.status === "active" ? "pro" : "free",
        status: subscription.status,
        current_period_end: (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscription.id);
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await supabase
      .from("subscriptions")
      .update({ plan: "free", status: "canceled", updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", subscription.id);
  }

  return NextResponse.json({ received: true });
}
