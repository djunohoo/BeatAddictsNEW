import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();

    if (typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (message.length > 4000) {
      return new Response(
        JSON.stringify({ error: 'message is too long (max 4000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (conversationHistory !== undefined && conversationHistory !== null && !Array.isArray(conversationHistory)) {
      return new Response(
        JSON.stringify({ error: 'conversationHistory must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');

    if (!baseUrl || !apiKey) {
      throw new Error('AI service not configured');
    }

    // Build conversation messages
    const messages = [
      {
        role: 'system',
        content: `You are Pulse, an energetic and knowledgeable music production assistant for Beat Addicts DAW. You help users with:
- Music theory and composition
- Sound design and mixing techniques
- Beat making and rhythm programming
- Genre-specific production tips
- Creative workflow suggestions
- Technical troubleshooting

Keep responses concise (2-3 sentences), friendly, and actionable. Use music production terminology but explain complex concepts simply. Be encouraging and inspire creativity.`
      },
      ...(conversationHistory || []).slice(-6), // Last 6 messages for context
      {
        role: 'user',
        content: message
      }
    ];

    // Call OnSpace AI
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        temperature: 0.8,
        max_tokens: 200
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API Error: ${errorText}`);
    }

    const data = await response.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== 'string') {
      console.error('Pulse Chat: unexpected upstream response shape', data);
      return new Response(
        JSON.stringify({ error: 'AI service returned no content' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Pulse Chat Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to get response from Pulse' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
