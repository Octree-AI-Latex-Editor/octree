export const SUPPORTED_TEXT_FILE_TYPES = {
  'text/x-tex': ['.tex'],
  'text/x-bibtex': ['.bib'],
  'text/x-latex': ['.sty', '.cls'],
  'text/markdown': ['.md'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],
  'text/javascript': ['.js'],
  'text/typescript': ['.ts'],
  'text/x-python': ['.py'],
  'text/x-java': ['.java'],
  'text/x-c++src': ['.cpp'],
  'text/x-c': ['.c'],
  'text/html': ['.html'],
  'text/css': ['.css'],
  'application/xml': ['.xml'],
  'application/x-yaml': ['.yaml', '.yml'],
};

export const SUPPORTED_TEXT_FILE_EXTENSIONS = [
  '.tex',
  '.bib',
  '.sty',
  '.cls',
  '.txt',
  '.md',
  '.json',
  '.js',
  '.ts',
  '.py',
  '.java',
  '.cpp',
  '.c',
  '.html',
  '.css',
  '.xml',
  '.yaml',
  '.yml',
];

export const MAX_TEXT_FILE_SIZE = 10 * 1024 * 1024;

export function getContentTypeByFilename(filename: string): string {
  const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  
  for (const [contentType, extensions] of Object.entries(SUPPORTED_TEXT_FILE_TYPES)) {
    if (extensions.includes(extension)) {
      return contentType;
    }
  }
  
  return 'text/plain';
}
