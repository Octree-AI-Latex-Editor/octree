// Subscription and usage limits
export const FREE_DAILY_EDIT_LIMIT = 100;
export const PRO_MONTHLY_EDIT_LIMIT = 200;
export const PRO_SUBSCRIPTION_PRICE = 10; // USD per month

export const DEFAULT_LATEX_CONTENT = (title: string) => `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{${title}}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
This is the main document for your project: ${title}.

\\section{Getting Started}
You can start writing your LaTeX content here.

\\end{document}`;

export const NON_LATEX_FILE_CONTENT = (fileName: string, projectTitle: string, fileSize: number | null, fileType: string | null) => `// File: ${fileName}
// Project: ${projectTitle}
// Size: ${fileSize || 'Unknown'} bytes
// Type: ${fileType || 'Unknown'}

// File content would be loaded here in a real implementation.
// This file type (${fileType || 'unknown'}) is not currently supported for editing.`;
