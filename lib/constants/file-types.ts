export const SUPPORTED_TEXT_FILE_TYPES = {
  'text/x-tex': ['.tex'],
  'text/x-bibtex': ['.bib', '.bst'],
  'text/x-latex': ['.sty', '.cls'],
  'text/markdown': ['.md'],
  'text/plain': ['.txt', '.log'],
  'text/csv': ['.csv'],
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
  '.bst',
  '.sty',
  '.cls',
  '.txt',
  '.log',
  '.csv',
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

export const BINARY_FILE_EXTENSIONS = [
  '.eps',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.tiff',
  '.tif',
  '.pdf',
  '.ps',
  '.svg',
  '.webp',
  '.ico',
] as const;

export const MAX_TEXT_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_BINARY_FILE_SIZE = 50 * 1024 * 1024;

export const IMAGE_FILE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
  '.bmp',
  '.ico',
] as const;

export const SUPPORTED_BINARY_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/svg+xml': ['.svg'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp'],
  'image/x-icon': ['.ico'],
};

export const ALL_SUPPORTED_FILE_TYPES = {
  ...SUPPORTED_TEXT_FILE_TYPES,
  ...SUPPORTED_BINARY_FILE_TYPES,
};

export const ALL_SUPPORTED_FILE_EXTENSIONS = [
  ...SUPPORTED_TEXT_FILE_EXTENSIONS,
  '.pdf',
  ...IMAGE_FILE_EXTENSIONS,
];

export function isBinaryFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return BINARY_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function isImageFile(filename: string): boolean {
  const lowerName = filename.toLowerCase();
  return IMAGE_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function isPDFFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf');
}

const BINARY_FILE_MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.eps': 'application/postscript',
  '.ps': 'application/postscript',
};

export function getContentTypeByFilename(filename: string): string {
  const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();

  for (const [contentType, extensions] of Object.entries(
    SUPPORTED_TEXT_FILE_TYPES
  )) {
    if (extensions.includes(extension)) {
      return contentType;
    }
  }

  if (BINARY_FILE_MIME_TYPES[extension]) {
    return BINARY_FILE_MIME_TYPES[extension];
  }

  return 'application/octet-stream';
}
