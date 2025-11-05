export interface CompilationResult {
  success: boolean;
  pdfData: string | null;
  error: string | null;
}

export async function compilePdf(content: string): Promise<CompilationResult> {
  try {
    const response = await fetch('/api/compile-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: [
          {
            path: 'main.tex',
            content,
          },
        ],
        lastModifiedFile: 'main.tex',
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        pdfData: null,
        error: `Compilation failed with status ${response.status}`,
      };
    }

    const data = await response.json();

    if (data.pdf) {
      return {
        success: true,
        pdfData: data.pdf,
        error: null,
      };
    } else {
      return {
        success: false,
        pdfData: null,
        error: 'No PDF data received',
      };
    }
  } catch (error) {
    console.error('PDF compilation error:', error);
    return {
      success: false,
      pdfData: null,
      error: error instanceof Error ? error.message : 'Compilation failed',
    };
  }
}
