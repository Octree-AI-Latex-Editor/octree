import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { equation } = await request.json();

        if (!equation || typeof equation !== 'string' || equation.trim().length === 0) {
            return NextResponse.json(
                { error: 'equation text is required' },
                { status: 400 }
            );
        }

        // set the limit to 2000. lmk if it should be longer or shorter
        if (equation.length > 2000) {
            return NextResponse.json(
                { error: 'equation text too long' },
                { status: 400 }
            );
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('OPENAI_API_KEY not found');
            return NextResponse.json(
                { error: 'service configuration error' },
                { status: 500 }
            );
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a LaTeX expert. Convert natural language equation descriptions into proper LaTeX code. Follow these rules:
1. Return ONLY the LaTeX code, no explanations or markdown
2. Use appropriate math environments (inline $ $ or display $$ $$)
3. Use proper LaTeX commands (\\frac, \\sqrt, \\sum, \\int, etc.)
4. For display equations, use equation or align environments when appropriate
5. Include necessary packages hints in comments if needed (e.g., % requires amsmath)
6. Be concise and accurate`,
                    },
                    {
                        role: 'user',
                        content: `Convert this equation to LaTeX: ${equation}`,
                    },
                ],
                temperature: 0.3,
                max_tokens: 1000,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenAI API error:', errorData);
            return NextResponse.json(
                { error: 'failed to convert equation' },
                { status: 500 }
            );
        }

        const data = await response.json();
        const latex = data.choices[0]?.message?.content;

        if (!latex) {
            return NextResponse.json(
                { error: 'no latex generated' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            latex: latex.trim(),
        });
    } catch (error) {
        console.error('Equation to latex conversion error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}