/**
 * AST-based edit classification and validation utilities
 * Provides structured edit type classification and validation logic
 */

import { IntentResult } from './intent-inference';

export type ASTEditType = 'insert' | 'delete' | 'replace' | 'reorder' | 'nest' | 'unnest' | 'style';

export interface ASTEdit {
  editType: ASTEditType;
  nodeType?: string;
  nodePath?: string;
  content?: string;
  position?: {
    line?: number;
    column?: number;
    astPath?: string;
  };
  originalLineCount?: number; // How many lines to affect
  explanation?: string;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  violations: string[];
  acceptedEdits: ASTEdit[];
}

/**
 * AST-based edit classification for LaTeX utilities
 * @param editType - The edit type string
 * @param nodeType - Optional node type for context
 * @returns Classified edit type
 */
export function classifyASTEdit(editType: string, nodeType?: string): ASTEditType {
  switch (editType.toLowerCase()) {
    case 'insert':
    case 'add':
    case 'create':
      return 'insert';
    case 'delete':
    case 'remove':
    case 'eliminate':
      return 'delete';
    case 'replace':
    case 'substitute':
    case 'swap':
      return 'replace';
    case 'reorder':
    case 'rearrange':
    case 'move':
      return 'reorder';
    case 'nest':
    case 'group':
    case 'combine':
      return 'nest';
    case 'unnest':
    case 'ungroup':
    case 'separate':
      return 'unnest';
    case 'style':
    case 'format':
      return 'style';
    default:
      return 'unknown' as ASTEditType;
  }
}


/**
 * Validate AST edits against user intent and constraints
 * @param edits - Array of proposed edits
 * @param intent - User intent permissions
 * @param fileContent - Full file content for duplication checking
 * @returns Validation result with accepted edits and violations
 */
export function validateASTEdits(
  edits: ASTEdit[],
  intent: IntentResult, // IntentResult type from intent-inference.ts
  fileContent: string
): ValidationResult {
  const violations: string[] = [];
  const acceptedEdits: ASTEdit[] = [];
  
  for (const edit of edits) {
    const kind = classifyASTEdit(edit.editType, edit.nodeType);
    
    // Enforce intent-based permissions for AST operations
    if (kind === 'insert') {
      if (edit.nodeType && ['section', 'subsection', 'paragraph', 'item', 'bullet', 'list', 'table', 'figure', 'equation'].includes(edit.nodeType)) {
        if (!intent.allowInsertNode) {
          violations.push(`Node insertion not allowed by inferred intent for ${edit.nodeType} at ${edit.position?.line || 'unknown position'}.`);
          continue;
        }
      } else if (!intent.allowInsertContent) {
        violations.push(`Content insertion not allowed by inferred intent at ${edit.position?.line || 'unknown position'}.`);
        continue;
      }
    }
    
    if (kind === 'delete') {
      if (edit.nodeType && ['section', 'subsection', 'paragraph', 'item', 'bullet', 'list', 'table', 'figure', 'equation'].includes(edit.nodeType)) {
        if (!intent.allowDeleteNode) {
          violations.push(`Node deletion not allowed by inferred intent for ${edit.nodeType} at ${edit.position?.line || 'unknown position'}.`);
          continue;
        }
      } else if (!intent.allowDeleteContent) {
        violations.push(`Content deletion not allowed by inferred intent at ${edit.position?.line || 'unknown position'}.`);
        continue;
      }
    }
    
    if (kind === 'replace') {
      if (edit.nodeType && ['section', 'subsection', 'paragraph', 'item', 'bullet', 'list', 'table', 'figure', 'equation'].includes(edit.nodeType)) {
        if (!intent.allowReplaceNode) {
          violations.push(`Node replacement not allowed by inferred intent for ${edit.nodeType} at ${edit.position?.line || 'unknown position'}.`);
          continue;
        }
      } else if (!intent.allowReplaceContent) {
        violations.push(`Content replacement not allowed by inferred intent at ${edit.position?.line || 'unknown position'}.`);
        continue;
      }
    }
    
    if (kind === 'reorder' && !intent.allowReorder) {
      violations.push(`Reordering not allowed by inferred intent at ${edit.position?.line || 'unknown position'}.`);
      continue;
    }
    
    if (kind === 'nest' && !intent.allowNest) {
      violations.push(`Nesting not allowed by inferred intent at ${edit.position?.line || 'unknown position'}.`);
      continue;
    }
    
    if (kind === 'unnest' && !intent.allowUnnest) {
      violations.push(`Unnesting not allowed by inferred intent at ${edit.position?.line || 'unknown position'}.`);
      continue;
    }
    
    if (kind === 'style' && !intent.allowStyleChange) {
      violations.push(`Style change not allowed by inferred intent at ${edit.position?.line || 'unknown position'}.`);
      continue;
    }
    
    // Duplication guards removed - allow all legitimate edits
    
    acceptedEdits.push(edit);
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    acceptedEdits
  };
}
