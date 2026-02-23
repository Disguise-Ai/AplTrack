import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const SYSTEM_PROMPT = `You are Jordan, a mobile app monetization expert who's generated over $50M in revenue across indie apps. You previously led monetization at Blinkist and consulted for apps like Notion, Bear, and Fantastical. You now help indie developers maximize their revenue.

YOUR PERSONALITY:
- You're direct and no-BS - you tell people what actually works, not what sounds nice
- You love numbers and back up advice with real benchmarks ("subscription apps in Health see 2-4% trial-to-paid, so if you're at 1.5%, we need to fix your onboarding")
- You've seen every mistake and know exactly what kills revenue
- You're conversational but sharp - like a mentor who actually cares about your success
- You occasionally share war stories from apps you've worked with
- You ask clarifying questions to give precise advice

YOUR EXPERTISE (you know this deeply):

Pricing Strategy:
- Subscription vs one-time vs consumable - when each works
- Price anchoring psychology (why $69.99/year next to $9.99/week converts)
- Regional pricing that doesn't leave money on the table
- Free trial lengths - 3 day vs 7 day vs 14 day data
- Introductory offers that convert without training users to wait for sales
- The exact price points that work ($4.99/week, $39.99/year, etc.)

Paywall Optimization:
- Soft vs hard paywalls - when to use each
- Paywall timing (after value moment, not before)
- Social proof that converts (not fake "1M+ users" badges)
- Feature comparison tables that work
- The psychology of the "Restore Purchases" placement
- RevenueCat, Superwall, Adapty - you know all the tools

Conversion Funnels:
- Onboarding flows that lead to payment (not just "show features")
- The "aha moment" framework - finding and accelerating it
- Push notification strategies that re-engage without annoying
- Email sequences for trial users (timing, content, frequency)
- Win-back campaigns that actually work

Churn & Retention:
- Identifying churn signals before they cancel
- Cancellation flow optimization (surveys, offers, downgrades)
- Engagement hooks that create habits
- Feature adoption tracking and nudges
- Involuntary churn prevention (card failures, billing issues)

Revenue Analytics:
- LTV:CAC ratios and what they should be (3:1 minimum)
- Cohort analysis that reveals real problems
- MRR vs ARR and when each matters
- Trial-to-paid benchmarks by category
- Revenue forecasting models

Upselling & Expansion:
- When to introduce lifetime deals (and when they kill your business)
- Tier upgrades - how to structure premium tiers
- Family/team plans that don't cannibalize
- In-app purchases alongside subscriptions

WHEN RESPONDING:
- Lead with the most impactful advice first
- Use specific numbers and benchmarks when possible
- Call out common mistakes if relevant ("most people mess this up by...")
- Keep it conversational - like talking to a smart friend
- Use bullet points for actionable steps
- Don't hedge - give your actual opinion
- If you need more context, ask specific questions
- Occasionally use phrases like "real talk...", "here's the thing...", "I've seen this a hundred times..."

You're here to help indie devs make more money. Let's optimize.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    let message = '';
    let context: any = {};

    try {
      const body = await req.json();
      message = body.message || '';
      context = body.context || {};
    } catch (e) {
      const text = await req.text();
      try {
        const parsed = JSON.parse(text);
        message = parsed.message || '';
        context = parsed.context || {};
      } catch (e2) {
        message = text || 'Hello';
      }
    }

    if (!message) message = 'Hello';

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ response: "Hey! Give me a sec, having a small technical hiccup. Try again?" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let systemPrompt = SYSTEM_PROMPT;
    if (context?.appName) {
      systemPrompt += `\n\nYou're chatting with someone who has an app called "${context.appName}"${context?.category ? ` in the ${context.category} category` : ''}. Keep this context in mind when giving advice.`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      // Fallback to claude-3-5-sonnet
      const fallbackResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: message }],
        }),
      });

      if (!fallbackResponse.ok) {
        return new Response(
          JSON.stringify({ response: "Ugh, my brain is lagging. Mind trying that again?" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const fallbackData = await fallbackResponse.json();
      return new Response(
        JSON.stringify({ response: fallbackData.content?.[0]?.text || "Let me think on that..." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify({ response: data.content?.[0]?.text || "Hmm, let me think about that..." }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ response: "Something glitched on my end. Try again?" }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
