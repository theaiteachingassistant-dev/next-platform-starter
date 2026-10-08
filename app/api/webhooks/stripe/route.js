import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req) {
  // 1. Read the incoming message from Stripe
  const body = await req.text();
  const signature = headers().get('stripe-signature');

  let event;

  // 2. Cryptographically verify the message is authentic
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // 3. If the payment was successful, upgrade the user
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // This is the specific Clerk User ID we securely passed to Stripe in the previous step
    const clerkUserId = session.client_reference_id; 

    if (clerkUserId) {
      try {
        const client = await clerkClient();
        
        // This attaches a permanent "isPro: true" badge to their account
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            isPro: true,
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          }
        });
      } catch (error) {
        console.error('Clerk Metadata Update Error:', error);
      }
    }
  }

  // 4. Return a 200 OK so Stripe knows we received it
  return new NextResponse('Webhook processed successfully', { status: 200 });
}
