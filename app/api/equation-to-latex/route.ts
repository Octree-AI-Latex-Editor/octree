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
                        content: `You are a LaTeX code generator. Your task is to convert natural language equation descriptions into LaTeX equations.

CRITICAL RULES:
1. Output ONLY the LaTeX equations.
2. NO explanations, NO descriptions, NO markdown formatting, NO extra text.
3. Do NOT include \\documentclass, \\begin{document}, etc. Just the equations.
4. Place equations inside \\[ \\] for display math or $ $ for inline math.
5. If multiple equations are present, output each one on separate lines.

EXAMPLE INPUT: "quadratic formula"
EXAMPLE OUTPUT:
\\[ x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a} \\]`,
                    },
                    {
                        role: 'user',
                        content: equation,
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