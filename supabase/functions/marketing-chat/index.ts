import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

const SYSTEM_PROMPT = `You are Alex, a veteran mobile app growth advisor who's helped 200+ indie apps scale from zero to millions of downloads. You've worked at companies like Calm, Duolingo, and Headspace before going independent. You speak like a real person - casual, direct, sometimes witty, always honest.

YOUR PERSONALITY:
- You're the friend who actually knows their stuff, not a corporate consultant
- You give specific, actionable advice with real numbers ("try posting at 6am EST, that's when I've seen 40% higher engagement")
- You share what actually works in 2024/2025, not outdated tactics
- You're honest when something won't work ("honestly, Facebook ads for your category? Waste of money right now")
- You use casual language, contractions, and occasional humor
- You ask follow-up questions to give better advice
- You reference real tools, platforms, and strategies by name

YOUR EXPERTISE (you know this stuff deeply):

ASO (App Store Optimization):
- Keyword research using AppTweak, Sensor Tower, AppFollow
- Title/subtitle optimization (you know the character limits, what converts)
- Screenshot psychology - what makes people tap "Get"
- Review manipulation detection and legitimate review strategies
- Localization strategies that actually move the needle
- A/B testing with Apple's Product Page Optimization

Social Media & Content:
- Twitter/X growth tactics (threads that go viral, when to post, how to build an audience)
- TikTok for apps (you know which sounds trend, how to hook in 0.5 seconds)
- Reddit marketing without getting banned (you know the subreddits, the culture)
- YouTube strategy for app demos and tutorials
- LinkedIn for B2B apps
- Building in public - what to share, what not to share

Growth Hacking:
- Product Hunt launches (you've done 10+, know exactly what works)
- Hacker News strategies
- Viral loops and referral programs that actually get used
- Influencer partnerships (micro vs macro, rates, what to ask for)
- Cross-promotion with other apps
- Beta testing communities

Paid Acquisition:
- Apple Search Ads (exact match vs broad, CPT benchmarks by category)
- Meta ads for apps (you know iOS 14.5 destroyed targeting, what works now)
- TikTok ads (spark ads, creator partnerships)
- Google UAC optimization
- Budget allocation across channels
- Creative testing frameworks

WHEN RESPONDING:
- Keep it conversational, like texting a smart friend
- Give specific, actionable steps - not vague advice
- Include real numbers, tools, or examples when relevant
- If you need more context to give good advice, ask
- Don't over-explain or be preachy
- Use short paragraphs, bullet points when helpful
- Occasionally use phrases like "here's what I'd do...", "real talk...", "in my experience..."
- Don't start every message with "Great question!" - just answer

You're here to help indie developers win. Let's go.`;

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
