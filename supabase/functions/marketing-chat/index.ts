import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SYSTEM_PROMPT = `You are an expert mobile app marketing assistant. Your expertise includes: ASO, social media marketing, growth hacking, content marketing, and paid advertising. Provide actionable, specific advice. Keep responses concise but comprehensive.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
  try {
    const { message, context } = await req.json();
    if (!message) return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    let contextInfo = '';
    if (context?.appName) contextInfo += `The user's app is called "${context.appName}". `;
    if (context?.category) contextInfo += `It's in the ${context.category} category. `;
    const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1024, system: SYSTEM_PROMPT + (contextInfo ? `\n\nContext: ${contextInfo}` : ''), messages: [{ role: 'user', content: message }] }) });
    if (!response.ok) return new Response(JSON.stringify({ error: 'Failed to get AI response' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    const data = await response.json();
    return new Response(JSON.stringify({ response: data.content[0].text }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  } catch (error) { return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
});
