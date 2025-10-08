/**
 * Octra Agent - Modular LaTeX AI Assistant
 * 
 * This module provides a clean, modular architecture for the Octra AI agent
 * that handles LaTeX document editing with AST-based operations.
 */

// Core functionality exports
export * from './intent-inference';
export * from './ast-edits';
export * from './content-processing';
export * from './tools';
export * from './stream-handling';
export * from './config';

// Re-export commonly used types
export type { IntentResult } from './intent-inference';
export type { ASTEdit, ASTEditType, ValidationResult } from './ast-edits';
export type { ToolContext } from './tools';
export type { StreamController, StreamMessage } from './stream-handling';
