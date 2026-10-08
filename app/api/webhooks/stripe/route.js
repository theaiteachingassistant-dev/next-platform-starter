import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req) {
  const body = await req.text();
  const signature = headers().get('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const clerkUserId = session.client_reference_id; 

    if (clerkUserId && session.subscription) {
      try {
        // Fetch the subscription details directly from Stripe to see exactly what they bought
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = subscription.items.data[0].price.id;

        // PASTE YOUR TWO PRO TIER PRICE IDs HERE:
        const proPriceIds = ['price_1UMmu2F5h8YEG0YhuedRiwTJ', 'price_1UNvxoF5h8YEG0YhMuRLwJir'];
        const isProTier = proPriceIds.includes(priceId);

        const client = await clerkClient();
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            hasPaid: true,
            tier: isProTier ? 'pro' : 'basic',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          }
        });
      } catch (error) {
        console.error('Clerk Metadata Update Error:', error);
      }
    }
  }

  return new NextResponse('Webhook processed successfully', { status: 200 });
}
