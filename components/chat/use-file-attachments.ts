import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { FileAttachment, MAX_FILE_SIZE, MAX_ATTACHMENTS } from '@/types/attachment';

const buildImageContext = (dataUrl: string, fileName: string, mimeType: string) => {
  const base64 = dataUrl.startsWith('data:') ? dataUrl.split(',')[1] ?? '' : dataUrl;
  const intro = [
    `Image Attachment: ${fileName} (${mimeType})`,
    'The next block contains the base64 encoding of the image. '
    + 'Decode and inspect it carefully. '
    + 'If it contains mathematics (equations, integrals, limits, etc.), read and transcribe them exactly. '
    + 'Then respond to the user\'s question using those expressions.',
  ].join('\n');
  return `${intro}\n\n\`\`\`base64\n${base64}\n\`\`\``;
};

export function useFileAttachments() {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  const readFileContent = async (file: File): Promise<string | undefined> => {
    // For text files, read the content
    if (file.type.startsWith('text/') || 
        file.type === 'application/json' ||
        file.type === 'application/x-tex' ||
        file.type === 'text/x-tex' ||
        file.name.endsWith('.tex') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.txt')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }
    
    // For images, create a preview
    if (file.type.startsWith('image/')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }
    
    return undefined;
  };

  const addFiles = useCallback(async (files: File[]) => {
    const newAttachments: FileAttachment[] = [];
    
    for (const file of files) {
      // Check max attachments
      if (attachments.length + newAttachments.length >= MAX_ATTACHMENTS) {
        console.warn(`Maximum ${MAX_ATTACHMENTS} attachments allowed`);
        break;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        newAttachments.push({
          id: uuid(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'error',
          error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        });
        continue;
      }
      
      // Add file with uploading status
      const attachment: FileAttachment = {
        id: uuid(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
      };
      
      newAttachments.push(attachment);
    }
    
    setAttachments((prev) => [...prev, ...newAttachments]);
    
    // Process files asynchronously
    for (const attachment of newAttachments) {
      if (attachment.status === 'error') continue;
      
      try {
        const content = await readFileContent(attachment.file);
        
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachment.id
              ? {
                  ...a,
                  content: attachment.file.type.startsWith('image/') ? undefined : content,
                  preview: attachment.file.type.startsWith('image/') ? content : undefined,
                  status: 'ready' as const,
                }
              : a
          )
        );
      } catch (error) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === attachment.id
              ? {
                  ...a,
                  status: 'error' as const,
                  error: 'Failed to read file',
                }
              : a
          )
        );
      }
    }
  }, [attachments.length]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const getAttachmentContext = useCallback(() => {
    const readyAttachments = attachments.filter((a) => a.status === 'ready');
    
    if (readyAttachments.length === 0) return null;
    
    let context = '\n\n--- Attached Files ---\n';
    
    for (const attachment of readyAttachments) {
      context += `\nFile: ${attachment.name} (${attachment.type})\n`;
      
      if (attachment.content) {
        context += `Content:\n\`\`\`\n${attachment.content}\n\`\`\`\n`;
      } else if (attachment.preview) {
        context += `${buildImageContext(attachment.preview, attachment.name, attachment.type)}\n`;
      } else {
        context += `[Binary file: ${attachment.name}]\n`;
      }
    }
    
    return context;
  }, [attachments]);

  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    getAttachmentContext,
    hasAttachments: attachments.length > 0,
    canAddMore: attachments.length < MAX_ATTACHMENTS,
  };
}

