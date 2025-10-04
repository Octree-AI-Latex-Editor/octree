/**
 * Tool definitions for the Octra Agent SDK
 * Defines the tools available to the AI agent for LaTeX document editing
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { ASTEdit, validateASTEdits } from './ast-edits';
import { IntentResult } from './intent-inference';

export interface ToolContext {
  fileContent: string;
  numberedContent: string;
  textFromEditor?: string | null;
  selectionRange?: { startLineNumber: number; endLineNumber: number } | null;
  collectedEdits: ASTEdit[];
  intent: IntentResult;
  writeEvent: (event: string, data: unknown) => void;
}

/**
 * Create the get_context tool for retrieving file information
 * @param context - Tool context with file data and event writer
 * @returns Configured tool instance
 */
export function createGetContextTool(context: ToolContext) {
  return tool(
    'get_context',
    'Retrieve the current LaTeX file context with numbered lines and optional user selection.',
    {
      includeNumbered: z.boolean().optional().default(true),
      includeSelection: z.boolean().optional().default(true),
    },
    async (args) => {
      const payload: Record<string, unknown> = {
        lineCount: context.fileContent.split('\n').length,
      };
      if (args.includeNumbered !== false) {
        payload.numberedContent = context.numberedContent;
      }
      if (args.includeSelection !== false && context.textFromEditor) {
        payload.selection = context.textFromEditor;
      }
      if (context.selectionRange) {
        payload.selectionRange = context.selectionRange;
      }
      context.writeEvent('tool', { name: 'get_context' });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload),
          },
        ],
      };
    }
  );
}

/**
 * Create the propose_edits tool for suggesting AST-based edits
 * @param context - Tool context with file data, intent, and event writer
 * @returns Configured tool instance
 */
export function createProposeEditsTool(context: ToolContext) {
  return tool(
    'propose_edits',
    'Propose JSON-structured AST-based edits to the LaTeX document. Use when ready to suggest concrete changes.',
    {
      edits: z
        .array(
          z.object({
            editType: z.enum(['insert', 'delete', 'replace', 'reorder', 'nest', 'unnest', 'style']),
            nodeType: z.string().optional(), // e.g., 'section', 'paragraph', 'item', 'text'
            nodePath: z.string().optional(), // AST path to the node
            content: z.string().optional(), // New content for the node
            position: z.object({
              line: z.number().int().min(1).optional(),
              column: z.number().int().min(1).optional(),
              astPath: z.string().optional(),
            }).optional(),
            originalLineCount: z.number().int().min(0).optional(), // How many lines to affect
            explanation: z.string().optional(),
            metadata: z.record(z.any()).optional(), // Additional AST metadata
          })
        )
        .min(1),
    },
    async (args) => {
      const validation = validateASTEdits(args.edits, context.intent, context.fileContent);
      
      // Add accepted edits to the collection
      context.collectedEdits.push(...validation.acceptedEdits);
      
      context.writeEvent('tool', { 
        name: 'propose_edits', 
        count: validation.acceptedEdits.length, 
        violations: validation.violations 
      });
      
      if (validation.acceptedEdits.length > 0) {
        context.writeEvent('edits', validation.acceptedEdits);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: `Accepted ${validation.acceptedEdits.length} edit(s). ${validation.violations.length ? 'Blocked ' + validation.violations.length + ' edit(s) due to intent restrictions.' : ''}`,
          },
        ],
      };
    }
  );
}

/**
 * Create all tools for the Octra Agent SDK
 * @param context - Tool context with all necessary data
 * @returns Array of configured tool instances
 */
export function createOctraTools(context: ToolContext) {
  return [
    createGetContextTool(context),
    createProposeEditsTool(context),
  ];
}
