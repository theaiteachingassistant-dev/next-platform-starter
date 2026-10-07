import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  // 1. Authenticate the request via Clerk
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const { prompt, type, requestCount = 1 } = await req.json();

  // 2. Initialize Supabase Admin to safely manage billing quotas
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 3. Fetch or Initialize User Subscription
  let { data: sub } = await supabase.from('subscriptions').select('*').eq('user_id', userId).single();

  if (!sub) {
    const { data: newSub } = await supabase.from('subscriptions').insert([{ user_id: userId, tier_level: 'free', weekly_sheet_count: 0 }]).select().single();
    sub = newSub;
  }

  // 4. Process Weekly Quota Reset
  if (new Date() > new Date(sub.reset_date)) {
    const nextReset = new Date();
    nextReset.setDate(nextReset.getDate() + 7);
    const { data: resetSub } = await supabase.from('subscriptions').update({ weekly_sheet_count: 0, reset_date: nextReset.toISOString() }).eq('user_id', userId).select().single();
    sub = resetSub;
  }

  // 5. Enforce Paywall Rules
  if (type === 'worksheet') {
    if (sub.tier_level === 'free') {
      return new Response(JSON.stringify({ error: 'Free tier limits reached. Upgrade to Pro to generate custom worksheets.' }), { status: 403 });
    }
    if (sub.tier_level === 'tier_1' && (sub.weekly_sheet_count + requestCount) > 60) {
      return new Response(JSON.stringify({ error: 'Tier 1 weekly limit (60) reached. Upgrade to Tier 2 for unlimited access.' }), { status: 403 });
    }
  }

  // 6. Execute Secure AI Request
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'AI API Error');

    // 7. Deduct Quota (Only upon successful generation, bypassing Tier 2 unlimited users)
    if (type === 'worksheet' && sub.tier_level !== 'tier_2') {
      await supabase.from('subscriptions').update({ weekly_sheet_count: sub.weekly_sheet_count + requestCount }).eq('user_id', userId);
    }

    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'AI processing failed' }), { status: 500 });
  }
}
