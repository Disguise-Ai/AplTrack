import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `You are an expert mobile app marketing assistant for indie developers and small teams. Your expertise includes:

1. **App Store Optimization (ASO)**
   - Keyword research and optimization
   - App title and subtitle optimization
   - Screenshot and preview video best practices
   - Ratings and reviews strategies

2. **Social Media Marketing**
   - Platform-specific strategies (Twitter, Reddit, TikTok, Instagram)
   - Content calendars and posting schedules
   - Community building and engagement
   - Viral marketing tactics

3. **Growth Hacking**
   - Product-led growth strategies
   - Referral programs
   - Viral loops and network effects
   - Launch strategies (Product Hunt, Hacker News, etc.)

4. **Content Marketing**
   - Blog content strategy
   - SEO for app developers
   - YouTube and video content
   - Newsletter and email marketing

5. **Paid Advertising**
   - Apple Search Ads optimization
   - Facebook/Meta ads for apps
   - Google App Campaigns
   - Budget allocation strategies

When responding:
- Be specific and actionable
- Provide step-by-step guidance when helpful
- Reference real-world examples when relevant
- Tailor advice to indie developers with limited budgets
- Keep responses focused and concise (2-4 paragraphs max unless more detail is needed)`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, context } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let contextInfo = '';
    if (context?.appName) contextInfo += `The user's app is called "${context.appName}". `;
    if (context?.category) contextInfo += `It's in the ${context.category} category. `;

    const systemPrompt = SYSTEM_PROMPT + (contextInfo ? `\n\nContext about the user's app: ${contextInfo}` : '');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to get AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify({ response: data.content[0].text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
