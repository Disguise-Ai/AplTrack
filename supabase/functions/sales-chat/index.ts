import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const SYSTEM_PROMPT = `You are an expert mobile app monetization and sales advisor for indie developers. Your expertise includes:

1. **Pricing Strategy**
   - Freemium vs paid vs subscription models
   - Price point optimization
   - Regional pricing strategies
   - Psychological pricing tactics
   - A/B testing pricing

2. **Conversion Optimization**
   - Paywall design and timing
   - Free trial optimization
   - Onboarding to conversion funnels
   - Reducing friction in purchase flow
   - Social proof and testimonials

3. **Upselling & Cross-selling**
   - In-app purchase strategies
   - Premium feature presentation
   - Bundle offerings
   - Upgrade path optimization
   - Lifetime deal strategies

4. **Churn Reduction**
   - Identifying churn indicators
   - Win-back campaigns
   - Cancellation flow optimization
   - Re-engagement strategies
   - Exit surveys and feedback loops

5. **Customer Retention**
   - Building habits and engagement loops
   - Push notification strategies
   - Loyalty programs
   - Feature adoption and stickiness
   - Customer success practices

6. **Revenue Analytics**
   - Key metrics (LTV, CAC, MRR, ARPU)
   - Cohort analysis
   - Revenue forecasting
   - Unit economics optimization

When responding:
- Be specific and data-driven when possible
- Provide actionable recommendations
- Consider the indie developer context (limited resources)
- Reference industry benchmarks when relevant
- Keep responses focused (2-4 paragraphs unless more detail is needed)`;

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
