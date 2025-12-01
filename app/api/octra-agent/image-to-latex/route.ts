import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { image, fileName } = await request.json();

    if (!image) {
      return new Response('Image is required', { status: 400 });
    }

    // Call OpenAI Vision API with GPT-4o-mini
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a LaTeX converter. Your task is to extract mathematical equations from the image and convert them into valid LaTeX code. Output ONLY the LaTeX code. Do not include any conversational text, descriptions, or explanations. If there are multiple equations, separate them with newlines.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Convert the equations in this image to LaTeX.

Image: ${fileName || 'image'}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      
      return new Response('Failed to process image', { status: 500 });
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Image to LaTeX conversion error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

