import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { genre, mood, stage } = await req.json();

    const isNonEmptyString = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
    if (!isNonEmptyString(genre) || !isNonEmptyString(mood) || !isNonEmptyString(stage)) {
      return new Response(
        JSON.stringify({ error: 'genre, mood, and stage are required strings (max 200 chars each)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');

    if (!baseUrl || !apiKey) {
      throw new Error('AI service not configured');
    }

    // Create a detailed prompt based on stage
    const stagePrompts: Record<string, string> = {
      'Beat Pattern': `Create a ${mood.toLowerCase()} ${genre.toLowerCase()} drum pattern. Describe a 16-step beat pattern with kick, snare, and hi-hat placements. Be specific about which steps (1-16) should have hits. Format your response as a clear grid pattern.`,
      'Melody': `Create a ${mood.toLowerCase()} melody for ${genre.toLowerCase()} music. Describe a melodic progression with specific notes, scales, and chord suggestions. Include the key and tempo recommendations.`,
      'Bassline': `Design a ${mood.toLowerCase()} bassline for ${genre.toLowerCase()}. Describe the bass pattern, note sequence, and rhythm that complements the beat. Include frequency range and groove characteristics.`,
      'Bass Drop': `Create an impactful bass drop for ${mood.toLowerCase()} ${genre.toLowerCase()} music. Describe the build-up, drop moment, and energy transition. Include sound design tips and arrangement ideas.`
    };

    const prompt = stagePrompts[stage] || `Create a ${mood.toLowerCase()} ${genre.toLowerCase()} music idea.`;

    // Call OnSpace AI
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert music producer and sound designer. Provide practical, actionable music production advice with specific technical details.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.9,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API Error: ${errorText}`);
    }

    const data = await response.json();
    const generatedContent = data?.choices?.[0]?.message?.content;
    if (typeof generatedContent !== 'string') {
      console.error('Generate Music: unexpected upstream response shape', data);
      return new Response(
        JSON.stringify({ error: 'AI service returned no content' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the response to extract pattern data (simplified for demo)
    const result = {
      stage,
      genre,
      mood,
      content: generatedContent,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Generate Music Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate music' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
