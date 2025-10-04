/**
 * Comprehensive test suite for the edit system
 * Tests all categories of user requests and edit operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { inferIntent } from '@/lib/octra-agent/intent-inference';
import { validateASTEdits, classifyASTEdit } from '@/lib/octra-agent/ast-edits';
import { buildNumberedContent } from '@/lib/octra-agent/content-processing';
import { EditSuggestion, isLegacyEditSuggestion } from '@/types/edit';

// Mock data for testing
const sampleLatexContent = `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}

\\title{Sample Document}
\\author{John Doe}
\\date{\\today}
\\maketitle

\\section{Introduction}
This is a sample LaTeX document for testing purposes.

\\subsection{Subsection}
Some content here.

\\end{document}`;

const sampleNumberedContent = `1: \\documentclass{article}
2: \\usepackage{amsmath}
3: \\begin{document}
4: 
5: \\title{Sample Document}
6: \\author{John Doe}
7: \\date{\\today}
8: \\maketitle
9: 
10: \\section{Introduction}
11: This is a sample LaTeX document for testing purposes.
12: 
13: \\subsection{Subsection}
14: Some content here.
15: 
16: \\end{document}`;

describe('Edit System Test Suite', () => {
  describe('Intent Inference Tests', () => {
    describe('Insert Operations', () => {
      it('should allow insert operations for explicit requests', () => {
        const testCases = [
          'add a new section',
          'insert a paragraph here',
          'create a new subsection',
          'add some content',
          'include additional text',
          'new section please',
          'add a summary section',
          'insert professional summary',
        ];

        testCases.forEach(request => {
          const intent = inferIntent(request);
          expect(intent.allowInsertContent).toBe(true);
          expect(intent.allowInsertNode).toBe(true);
        });
      });

      it('should allow insert operations for improvement requests', () => {
        const testCases = [
          'make it more concrete',
          'improve the content',
          'enhance the structure',
          'expand this section',
          'develop the introduction',
          'strengthen the conclusion',
        ];

        testCases.forEach(request => {
          const intent = inferIntent(request);
          expect(intent.allowInsertContent).toBe(true);
        });
      });
    });

    describe('Delete Operations', () => {
      it('should allow delete operations for explicit requests', () => {
        const testCases = [
          'delete this section',
          'remove the paragraph',
          'strip out the content',
          'drop this line',
          'remove duplicates',
          'delete redundant text',
        ];

        testCases.forEach(request => {
          const intent = inferIntent(request);
          expect(intent.allowDeleteContent).toBe(true);
          expect(intent.allowDeleteNode).toBe(true);
        });
      });

      it('should allow delete operations for cleanup requests', () => {
        const testCases = [
          'clean up the document',
          'remove duplicate sections',
          'deduplicate content',
          'clean up formatting',
        ];

        testCases.forEach(request => {
          const intent = inferIntent(request);
          expect(intent.allowDeleteContent).toBe(true);
        });
      });
    });

    describe('Replace Operations', () => {
      it('should allow replace operations for explicit requests', () => {
        const testCases = [
          'replace this text',
          'edit the content',
          'update the section',
          'revamp the introduction',
          'rewrite this paragraph',
          'fix the formatting',
          'correct the grammar',
        ];

        testCases.forEach(request => {
          const intent = inferIntent(request);
          expect(intent.allowReplaceContent).toBe(true);
          expect(intent.allowReplaceNode).toBe(true);
        });
      });

      it('should allow replace operations for improvement requests', () => {
        const testCases = [
          'improve this section',
          'enhance the content',
          'polish the text',
          'refine the language',
          'better formatting',
        ];

        testCases.forEach(request => {
          const intent = inferIntent(request);
          expect(intent.allowReplaceContent).toBe(true);
        });
      });
    });

    describe('Restriction Detection', () => {
      it('should block operations for read-only requests', () => {
        const testCases = [
          'only read the document',
          'just view the content',
          'merely check the text',
          'simply examine the file',
        ];

        testCases.forEach(request => {
          const intent = inferIntent(request);
          expect(intent.allowInsertContent).toBe(false);
          expect(intent.allowDeleteContent).toBe(false);
          expect(intent.allowReplaceContent).toBe(false);
        });
      });

      it('should block operations for negative restrictions', () => {
        const testCases = [
          "don't edit the file",
          'do not modify the content',
          'no edit please',
          'never change this',
          'avoid editing',
          'prevent editing',
          'stop editing',
        ];

        testCases.forEach(request => {
          const intent = inferIntent(request);
          expect(intent.allowInsertContent).toBe(false);
          expect(intent.allowDeleteContent).toBe(false);
          expect(intent.allowReplaceContent).toBe(false);
        });
      });

      it('should allow operations for mixed read/edit requests', () => {
        const testCases = [
          'read and then edit the document',
          'check the content and fix errors',
          'review and improve the text',
          'examine and update the section',
        ];

        testCases.forEach(request => {
          const intent = inferIntent(request);
          expect(intent.allowReplaceContent).toBe(true);
        });
      });
    });
  });

  describe('AST Edit Classification Tests', () => {
    it('should classify edit types correctly', () => {
      expect(classifyASTEdit('insert')).toBe('insert');
      expect(classifyASTEdit('add')).toBe('insert');
      expect(classifyASTEdit('delete')).toBe('delete');
      expect(classifyASTEdit('remove')).toBe('delete');
      expect(classifyASTEdit('replace')).toBe('replace');
      expect(classifyASTEdit('substitute')).toBe('replace');
      expect(classifyASTEdit('swap')).toBe('replace');
      expect(classifyASTEdit('reorder')).toBe('reorder');
      expect(classifyASTEdit('nest')).toBe('nest');
      expect(classifyASTEdit('unnest')).toBe('unnest');
      expect(classifyASTEdit('style')).toBe('style');
    });

    it('should handle unknown edit types', () => {
      expect(classifyASTEdit('unknown')).toBe('unknown');
      expect(classifyASTEdit('invalid')).toBe('unknown');
    });
  });

  describe('AST Edit Validation Tests', () => {
    const mockIntent = {
      allowInsertNode: true,
      allowDeleteNode: true,
      allowReplaceNode: true,
      allowInsertContent: true,
      allowDeleteContent: true,
      allowReplaceContent: true,
      allowReorder: true,
      allowNest: true,
      allowUnnest: true,
      allowStyleChange: true,
    };

    describe('Insert Operations', () => {
      it('should validate insert operations', () => {
        const edits = [
          {
            editType: 'insert' as const,
            position: { line: 10 },
            content: 'New content here',
            originalLineCount: 0,
          },
          {
            editType: 'insert' as const,
            nodeType: 'section',
            position: { line: 5 },
            content: '\\section{New Section}',
            originalLineCount: 0,
          },
        ];

        const result = validateASTEdits(edits, mockIntent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(2);
        expect(result.violations).toHaveLength(0);
      });

      it('should reject insert operations when not allowed', () => {
        const restrictedIntent = { ...mockIntent, allowInsertContent: false };
        const edits = [
          {
            editType: 'insert' as const,
            position: { line: 10 },
            content: 'New content',
            originalLineCount: 0,
          },
        ];

        const result = validateASTEdits(edits, restrictedIntent, sampleLatexContent);
        expect(result.isValid).toBe(false);
        expect(result.acceptedEdits).toHaveLength(0);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain('Content insertion not allowed');
      });
    });

    describe('Delete Operations', () => {
      it('should validate delete operations', () => {
        const edits = [
          {
            editType: 'delete' as const,
            position: { line: 10 },
            originalLineCount: 2,
          },
          {
            editType: 'delete' as const,
            nodeType: 'section',
            position: { line: 5 },
            originalLineCount: 1,
          },
        ];

        const result = validateASTEdits(edits, mockIntent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(2);
        expect(result.violations).toHaveLength(0);
      });

      it('should reject delete operations when not allowed', () => {
        const restrictedIntent = { ...mockIntent, allowDeleteContent: false };
        const edits = [
          {
            editType: 'delete' as const,
            position: { line: 10 },
            originalLineCount: 1,
          },
        ];

        const result = validateASTEdits(edits, restrictedIntent, sampleLatexContent);
        expect(result.isValid).toBe(false);
        expect(result.acceptedEdits).toHaveLength(0);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain('Content deletion not allowed');
      });
    });

    describe('Replace Operations', () => {
      it('should validate replace operations', () => {
        const edits = [
          {
            editType: 'replace' as const,
            position: { line: 10 },
            content: 'Replaced content',
            originalLineCount: 1,
          },
          {
            editType: 'replace' as const,
            nodeType: 'section',
            position: { line: 5 },
            content: '\\section{Updated Section}',
            originalLineCount: 1,
          },
        ];

        const result = validateASTEdits(edits, mockIntent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(2);
        expect(result.violations).toHaveLength(0);
      });

      it('should reject replace operations when not allowed', () => {
        const restrictedIntent = { ...mockIntent, allowReplaceContent: false };
        const edits = [
          {
            editType: 'replace' as const,
            position: { line: 10 },
            content: 'New content',
            originalLineCount: 1,
          },
        ];

        const result = validateASTEdits(edits, restrictedIntent, sampleLatexContent);
        expect(result.isValid).toBe(false);
        expect(result.acceptedEdits).toHaveLength(0);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain('Content replacement not allowed');
      });
    });

    describe('Complex Operations', () => {
      it('should validate multiple different operations', () => {
        const edits = [
          {
            editType: 'insert' as const,
            position: { line: 5 },
            content: 'New section',
            originalLineCount: 0,
          },
          {
            editType: 'delete' as const,
            position: { line: 10 },
            originalLineCount: 2,
          },
          {
            editType: 'replace' as const,
            position: { line: 15 },
            content: 'Updated content',
            originalLineCount: 1,
          },
        ];

        const result = validateASTEdits(edits, mockIntent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(3);
        expect(result.violations).toHaveLength(0);
      });

      it('should handle mixed valid and invalid operations', () => {
        const restrictedIntent = { 
          ...mockIntent, 
          allowInsertContent: false,
          allowDeleteContent: true,
          allowReplaceContent: true,
        };
        
        const edits = [
          {
            editType: 'insert' as const,
            position: { line: 5 },
            content: 'New content',
            originalLineCount: 0,
          },
          {
            editType: 'delete' as const,
            position: { line: 10 },
            originalLineCount: 1,
          },
          {
            editType: 'replace' as const,
            position: { line: 15 },
            content: 'Updated content',
            originalLineCount: 1,
          },
        ];

        const result = validateASTEdits(edits, restrictedIntent, sampleLatexContent);
        expect(result.isValid).toBe(false);
        expect(result.acceptedEdits).toHaveLength(2); // delete and replace
        expect(result.violations).toHaveLength(1); // insert blocked
      });
    });
  });

  describe('Content Processing Tests', () => {
    describe('Numbered Content Generation', () => {
      it('should generate numbered content for small files', () => {
        const smallContent = 'Line 1\nLine 2\nLine 3';
        const result = buildNumberedContent(smallContent);
        
        expect(result).toContain('1: Line 1');
        expect(result).toContain('2: Line 2');
        expect(result).toContain('3: Line 3');
        expect(result).not.toContain('...');
      });

      it('should generate truncated content for large files', () => {
        const largeContent = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\n');
        const result = buildNumberedContent(largeContent);
        
        expect(result).toContain('1: Line 1');
        expect(result).toContain('...');
        expect(result).toContain('901: Line 901'); // Should show end lines (lines 901-1000)
        expect(result).not.toContain('Line 500'); // Should be omitted
      });

      it('should handle empty content', () => {
        const result = buildNumberedContent('');
        expect(result).toBe('1: '); // Empty content still gets numbered
      });

      it('should handle single line content', () => {
        const result = buildNumberedContent('Single line');
        expect(result).toBe('1: Single line');
      });
    });
  });

  describe('Edit Suggestion Type Tests', () => {
    describe('Legacy vs AST Edit Detection', () => {
      it('should detect legacy edit suggestions', () => {
        const legacyEdit: EditSuggestion = {
          id: 'test-1',
          startLine: 5,
          originalLineCount: 2,
          suggested: 'New content',
          status: 'pending',
        };

        expect(isLegacyEditSuggestion(legacyEdit)).toBe(true);
      });

      it('should detect AST edit suggestions', () => {
        const astEdit: EditSuggestion = {
          id: 'test-2',
          editType: 'insert',
          position: { line: 5 },
          content: 'New content',
          originalLineCount: 0,
          status: 'pending',
        };

        expect(isLegacyEditSuggestion(astEdit)).toBe(false);
      });
    });

    describe('Edit Suggestion Properties', () => {
      it('should handle insert operations', () => {
        const insertEdit: EditSuggestion = {
          id: 'test-insert',
          editType: 'insert',
          position: { line: 10 },
          content: 'New content here',
          originalLineCount: 0,
          status: 'pending',
        };

        expect(insertEdit.editType).toBe('insert');
        expect(insertEdit.originalLineCount).toBe(0);
        expect(insertEdit.content).toBe('New content here');
      });

      it('should handle delete operations', () => {
        const deleteEdit: EditSuggestion = {
          id: 'test-delete',
          editType: 'delete',
          position: { line: 10 },
          originalLineCount: 3,
          status: 'pending',
        };

        expect(deleteEdit.editType).toBe('delete');
        expect(deleteEdit.originalLineCount).toBe(3);
        expect(deleteEdit.content).toBeUndefined();
      });

      it('should handle replace operations', () => {
        const replaceEdit: EditSuggestion = {
          id: 'test-replace',
          editType: 'replace',
          position: { line: 10 },
          content: 'Replaced content',
          originalLineCount: 2,
          status: 'pending',
        };

        expect(replaceEdit.editType).toBe('replace');
        expect(replaceEdit.originalLineCount).toBe(2);
        expect(replaceEdit.content).toBe('Replaced content');
      });
    });
  });

  describe('Real-World Scenario Tests', () => {
    describe('Resume/CV Editing Scenarios', () => {
      it('should handle adding a summary section', () => {
        const request = 'add a professional summary section';
        const intent = inferIntent(request);
        
        expect(intent.allowInsertContent).toBe(true);
        expect(intent.allowInsertNode).toBe(true);
        
        const edits = [
          {
            editType: 'insert' as const,
            position: { line: 8 },
            content: '\\section*{Summary}\nProfessional summary content here.',
            originalLineCount: 0,
          },
        ];
        
        const result = validateASTEdits(edits, intent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(1);
      });

      it('should handle making content more concrete', () => {
        const request = 'make the experience section more concrete';
        const intent = inferIntent(request);
        
        expect(intent.allowReplaceContent).toBe(true);
        
        const edits = [
          {
            editType: 'replace' as const,
            position: { line: 11 },
            content: 'This is a concrete example with specific metrics and achievements.',
            originalLineCount: 1,
          },
        ];
        
        const result = validateASTEdits(edits, intent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(1);
      });

      it('should handle removing duplicate content', () => {
        const request = 'remove duplicate sections';
        const intent = inferIntent(request);
        
        expect(intent.allowDeleteContent).toBe(true);
        expect(intent.wantsDedupe).toBe(true);
        
        const edits = [
          {
            editType: 'delete' as const,
            position: { line: 13 },
            originalLineCount: 2,
          },
        ];
        
        const result = validateASTEdits(edits, intent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(1);
      });
    });

    describe('Academic Paper Editing Scenarios', () => {
      it('should handle grammar corrections', () => {
        const request = 'fix grammar and spelling errors';
        const intent = inferIntent(request);
        
        expect(intent.allowReplaceContent).toBe(true);
        expect(intent.wantsGrammar).toBe(true);
        
        const edits = [
          {
            editType: 'replace' as const,
            position: { line: 11 },
            content: 'This is a sample LaTeX document for testing purposes.',
            originalLineCount: 1,
          },
        ];
        
        const result = validateASTEdits(edits, intent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(1);
      });

      it('should handle restructuring sections', () => {
        const request = 'reorder the sections for better flow';
        const intent = inferIntent(request);
        
        expect(intent.allowReorder).toBe(true);
        
        const edits = [
          {
            editType: 'reorder' as const,
            position: { line: 10 },
            originalLineCount: 5,
          },
        ];
        
        const result = validateASTEdits(edits, intent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(1);
      });
    });

    describe('Technical Document Editing Scenarios', () => {
      it('should handle adding code examples', () => {
        const request = 'add a code example to illustrate the concept';
        const intent = inferIntent(request);
        
        expect(intent.allowInsertContent).toBe(true);
        
        const edits = [
          {
            editType: 'insert' as const,
            position: { line: 12 },
            content: '\\begin{verbatim}\ncode example here\n\\end{verbatim}',
            originalLineCount: 0,
          },
        ];
        
        const result = validateASTEdits(edits, intent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(1);
      });

      it('should handle updating references', () => {
        const request = 'update the bibliography section';
        const intent = inferIntent(request);
        
        expect(intent.allowReplaceContent).toBe(true);
        
        const edits = [
          {
            editType: 'replace' as const,
            position: { line: 15 },
            content: '\\bibliography{references}',
            originalLineCount: 1,
          },
        ];
        
        const result = validateASTEdits(edits, intent, sampleLatexContent);
        expect(result.isValid).toBe(true);
        expect(result.acceptedEdits).toHaveLength(1);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    const mockIntent = {
      allowInsertNode: true,
      allowDeleteNode: true,
      allowReplaceNode: true,
      allowInsertContent: true,
      allowDeleteContent: true,
      allowReplaceContent: true,
      allowReorder: true,
      allowNest: true,
      allowUnnest: true,
      allowStyleChange: true,
    };

    it('should handle empty edit arrays', () => {
      const result = validateASTEdits([], mockIntent, sampleLatexContent);
      expect(result.isValid).toBe(true);
      expect(result.acceptedEdits).toHaveLength(0);
      expect(result.violations).toHaveLength(0);
    });

    it('should handle invalid line numbers', () => {
      const edits = [
        {
          editType: 'insert' as const,
          position: { line: -1 },
          content: 'Invalid line',
          originalLineCount: 0,
        },
        {
          editType: 'insert' as const,
          position: { line: 1000 },
          content: 'Out of bounds',
          originalLineCount: 0,
        },
      ];

      const result = validateASTEdits(edits, mockIntent, sampleLatexContent);
      // Should still validate the edit structure, line validation happens elsewhere
      expect(result.isValid).toBe(true);
      expect(result.acceptedEdits).toHaveLength(2);
    });

    it('should handle missing required fields', () => {
      const edits = [
        {
          editType: 'insert' as const,
          // Missing position
          content: 'No position',
          originalLineCount: 0,
        },
      ];

      const result = validateASTEdits(edits, mockIntent, sampleLatexContent);
      expect(result.isValid).toBe(true);
      expect(result.acceptedEdits).toHaveLength(1);
    });

    it('should handle malformed intent objects', () => {
      const malformedIntent = {
        allowInsertContent: true,
        // Missing other required fields
      } as any;

      const edits = [
        {
          editType: 'insert' as const,
          position: { line: 10 },
          content: 'Test content',
          originalLineCount: 0,
        },
      ];

      // Should not throw, but may not work as expected
      expect(() => validateASTEdits(edits, malformedIntent, sampleLatexContent)).not.toThrow();
    });
  });
});
