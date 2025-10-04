/**
 * AST-based intent inference using pattern matching instead of regex
 * Provides structured pattern matching for LaTeX document editing operations
 */

export interface IntentResult {
  // AST Node Operations
  allowInsertNode: boolean;
  allowDeleteNode: boolean;
  allowReplaceNode: boolean;
  
  // AST Content Operations
  allowInsertContent: boolean;
  allowDeleteContent: boolean;
  allowReplaceContent: boolean;
  
  // AST Structure Operations
  allowReorder: boolean;
  allowNest: boolean;
  allowUnnest: boolean;
  
  // AST Style Operations
  allowStyleChange: boolean;
  
  // Multi-operation flags
  multiEdit: boolean;
  fullRevamp: boolean;
  wantsDedupe: boolean;
  wantsGrammar: boolean;
  isReadOnly: boolean;
  
  // AST-specific flags
  wantsReorder: boolean;
  wantsNest: boolean;
  wantsUnnest: boolean;
  wantsStyleChange: boolean;
}

/**
 * AST Pattern Matching - Define patterns as structured objects
 */
const patterns = {
  // AST Node Operations
  insertNode: {
    verbs: ['insert', 'add', 'append', 'create', 'new'],
    objects: ['section', 'subsection', 'paragraph', 'item', 'bullet', 'list', 'table', 'figure', 'equation', 'text', 'content', 'element', 'node'],
    match: (t: string) => patterns.insertNode.verbs.some(v => 
      patterns.insertNode.objects.some(o => t.includes(`${v} ${o}`) || t.includes(`${v} a ${o}`))
    )
  },
  deleteNode: {
    verbs: ['delete', 'remove', 'strip', 'drop', 'eliminate'],
    objects: ['section', 'subsection', 'paragraph', 'item', 'bullet', 'list', 'table', 'figure', 'equation', 'text', 'content', 'element', 'node'],
    match: (t: string) => patterns.deleteNode.verbs.some(v => 
      patterns.deleteNode.objects.some(o => t.includes(`${v} ${o}`) || t.includes(`${v} the ${o}`))
    )
  },
  replaceNode: {
    verbs: ['replace', 'substitute', 'swap', 'exchange'],
    objects: ['section', 'subsection', 'paragraph', 'item', 'bullet', 'list', 'table', 'figure', 'equation', 'text', 'content', 'element', 'node'],
    match: (t: string) => patterns.replaceNode.verbs.some(v => 
      patterns.replaceNode.objects.some(o => t.includes(`${v} ${o}`) || t.includes(`${v} the ${o}`))
    )
  },
  
  // AST Content Operations
  insertContent: {
    verbs: ['insert', 'add', 'append', 'create', 'new'],
    objects: ['text', 'content', 'word', 'sentence', 'paragraph', 'phrase'],
    match: (t: string) => patterns.insertContent.verbs.some(v => 
      patterns.insertContent.objects.some(o => t.includes(`${v} ${o}`) || t.includes(`${v} a ${o}`))
    )
  },
  deleteContent: {
    verbs: ['delete', 'remove', 'strip', 'drop', 'eliminate'],
    objects: ['text', 'content', 'word', 'sentence', 'paragraph', 'phrase'],
    match: (t: string) => patterns.deleteContent.verbs.some(v => 
      patterns.deleteContent.objects.some(o => t.includes(`${v} ${o}`) || t.includes(`${v} the ${o}`))
    )
  },
  replaceContent: {
    verbs: ['replace', 'substitute', 'swap', 'exchange', 'change'],
    objects: ['text', 'content', 'word', 'sentence', 'paragraph', 'phrase'],
    match: (t: string) => patterns.replaceContent.verbs.some(v => 
      patterns.replaceContent.objects.some(o => t.includes(`${v} ${o}`) || t.includes(`${v} the ${o}`))
    )
  },
  
  // AST Structure Operations
  reorder: {
    keywords: ['reorder', 'rearrange', 'move', 'relocate', 'restructure', 'organize', 'sort'],
    match: (t: string) => patterns.reorder.keywords.some(k => t.includes(k))
  },
  nest: {
    keywords: ['nest', 'indent', 'group', 'combine', 'merge', 'consolidate'],
    match: (t: string) => patterns.nest.keywords.some(k => t.includes(k))
  },
  unnest: {
    keywords: ['unnest', 'unindent', 'ungroup', 'separate', 'split', 'divide'],
    match: (t: string) => patterns.unnest.keywords.some(k => t.includes(k))
  },
  
  // AST Style Operations
  styleChange: {
    keywords: ['style', 'format', 'bold', 'italic', 'underline', 'emphasize', 'highlight', 'color', 'font', 'size'],
    match: (t: string) => patterns.styleChange.keywords.some(k => t.includes(k))
  },
  grammar: {
    keywords: ['grammar', 'proofread', 'typo', 'spelling', 'punctuation', 'hyphen', 'capitalize', 'formatting'],
    match: (t: string) => patterns.grammar.keywords.some(k => t.includes(k))
  },
  cleanup: {
    keywords: ['cleanup', 'clean up', 'tidy', 'normalize', 'standardize', 'consistency', 'consistent'],
    match: (t: string) => patterns.cleanup.keywords.some(k => t.includes(k))
  },
  
  // Other Operations
  dedupe: {
    keywords: ['dedup', 'de-dup', 'duplicate', 'remove duplicates', 'duplicates'],
    match: (t: string) => patterns.dedupe.keywords.some(k => t.includes(k))
  },
  multi: {
    keywords: ['multi', 'multiple', 'several', 'batch', 'all', 'every'],
    match: (t: string) => patterns.multi.keywords.some(k => t.includes(k))
  },
  full: {
    keywords: ['complete revamp', 'rewrite everything', 'from scratch', 'restructure entire'],
    match: (t: string) => patterns.full.keywords.some(k => t.includes(k))
  },
  improve: {
    keywords: ['improve', 'enhance', 'polish', 'refine', 'better', 'strengthen', 'clarify', 'expand', 'elaborate', 'develop', 'concrete', 'specific', 'detailed', 'more concrete', 'more specific', 'add', 'insert', 'create', 'new section', 'new paragraph', 'include', 'incorporate'],
    match: (t: string) => patterns.improve.keywords.some(k => t.includes(k))
  },
  modify: {
    keywords: ['modify', 'change', 'adjust', 'tweak', 'revise', 'amend', 'correct', 'improve', 'polish'],
    match: (t: string) => patterns.modify.keywords.some(k => t.includes(k))
  },
  
  // Restriction Patterns
  explicitRestriction: {
    patterns: [
      { prefix: 'only', actions: ['read', 'view', 'check', 'examine', 'review', 'look', 'see'] },
      { prefix: 'just', actions: ['read', 'view', 'check', 'examine', 'review', 'look', 'see'] },
      { prefix: 'merely', actions: ['read', 'view', 'check', 'examine', 'review', 'look', 'see'] },
      { prefix: 'simply', actions: ['read', 'view', 'check', 'examine', 'review', 'look', 'see'] }
    ],
    match: (t: string) => patterns.explicitRestriction.patterns.some(p => 
      p.actions.some(a => t.includes(`${p.prefix} ${a}`))
    )
  },
  negativeRestriction: {
    patterns: [
      { prefix: "don't", actions: ['edit', 'modify', 'change', 'alter', 'update', 'delete', 'remove', 'add', 'insert', 'create', 'fix', 'correct'] },
      { prefix: 'do not', actions: ['edit', 'modify', 'change', 'alter', 'update', 'delete', 'remove', 'add', 'insert', 'create', 'fix', 'correct'] },
      { prefix: 'no', actions: ['edit', 'modify', 'change', 'alter', 'update', 'delete', 'remove', 'add', 'insert', 'create', 'fix', 'correct'] },
      { prefix: 'never', actions: ['edit', 'modify', 'change', 'alter', 'update', 'delete', 'remove', 'add', 'insert', 'create', 'fix', 'correct'] },
      { prefix: 'avoid', actions: ['edit', 'modify', 'change', 'alter', 'update', 'delete', 'remove', 'add', 'insert', 'create', 'fix', 'correct'] },
      { prefix: 'prevent', actions: ['edit', 'modify', 'change', 'alter', 'update', 'delete', 'remove', 'add', 'insert', 'create', 'fix', 'correct'] },
      { prefix: 'stop', actions: ['edit', 'modify', 'change', 'alter', 'update', 'delete', 'remove', 'add', 'insert', 'create', 'fix', 'correct'] }
    ],
    match: (t: string) => patterns.negativeRestriction.patterns.some(p => 
      p.actions.some(a => t.includes(`${p.prefix} ${a}`))
    )
  },
  readOnlyIntent: {
    readActions: ['read', 'view', 'check', 'examine', 'review', 'look', 'see', 'show', 'display', 'inspect', 'analyze', 'understand', 'explain', 'describe'],
    editActions: ['edit', 'modify', 'change', 'fix', 'correct', 'improve', 'add', 'remove', 'delete', 'insert', 'create'],
    match: (t: string) => {
      const hasReadAction = patterns.readOnlyIntent.readActions.some(a => t.includes(a));
      const hasEditAction = patterns.readOnlyIntent.editActions.some(a => t.includes(a));
      return hasReadAction && !hasEditAction;
    }
  }
};

/**
 * Infer user intent from text using AST-based pattern matching
 * @param userText - The user's input text
 * @returns IntentResult with permission flags and operation preferences
 */
export function inferIntent(userText: string): IntentResult {
  const text = (userText || '').toLowerCase();
  
  // Execute pattern matching
  const wantsInsertNode = patterns.insertNode.match(text);
  const wantsDeleteNode = patterns.deleteNode.match(text);
  const wantsReplaceNode = patterns.replaceNode.match(text);
  const wantsInsertContent = patterns.insertContent.match(text);
  const wantsDeleteContent = patterns.deleteContent.match(text);
  const wantsReplaceContent = patterns.replaceContent.match(text);
  const wantsReorder = patterns.reorder.match(text);
  const wantsNest = patterns.nest.match(text);
  const wantsUnnest = patterns.unnest.match(text);
  const wantsStyleChange = patterns.styleChange.match(text);
  const wantsGrammar = patterns.grammar.match(text);
  const wantsCleanup = patterns.cleanup.match(text);
  const wantsDedupe = patterns.dedupe.match(text);
  const wantsMulti = patterns.multi.match(text);
  const wantsFull = patterns.full.match(text);
  const wantsImprove = patterns.improve.match(text);
  const wantsModify = patterns.modify.match(text);
  
  const hasExplicitRestriction = patterns.explicitRestriction.match(text);
  const hasNegativeRestriction = patterns.negativeRestriction.match(text);
  const hasReadOnlyIntent = patterns.readOnlyIntent.match(text);
  
  // Permissive approach: allow AST operations by default unless explicitly restricted
  const hasExplicitASTRequest = wantsInsertNode || wantsDeleteNode || wantsReplaceNode || 
    wantsInsertContent || wantsDeleteContent || wantsReplaceContent ||
    wantsReorder || wantsNest || wantsUnnest || wantsStyleChange ||
    wantsGrammar || wantsCleanup || wantsDedupe || wantsFull || wantsImprove || wantsModify;
  
  // Default to allowing operations unless explicitly restricted
  const allowOperations = !hasExplicitRestriction && !hasNegativeRestriction;
  
  return {
    // AST Node Operations - allow by default unless restricted
    allowInsertNode: allowOperations,
    allowDeleteNode: allowOperations,
    allowReplaceNode: allowOperations,
    
    // AST Content Operations - allow by default unless restricted
    allowInsertContent: allowOperations,
    allowDeleteContent: allowOperations,
    allowReplaceContent: allowOperations,
    
    // AST Structure Operations - allow by default unless restricted
    allowReorder: allowOperations,
    allowNest: allowOperations,
    allowUnnest: allowOperations,
    
    // AST Style Operations - allow by default unless restricted
    allowStyleChange: allowOperations,
    
    // Multi-operation flags
    multiEdit: wantsMulti || wantsReplaceNode || wantsFull || wantsImprove,
    fullRevamp: wantsFull,
    wantsDedupe,
    wantsGrammar: wantsGrammar || wantsCleanup,
    isReadOnly: hasReadOnlyIntent || hasExplicitRestriction || hasNegativeRestriction,
    
    // AST-specific flags
    wantsReorder,
    wantsNest,
    wantsUnnest,
    wantsStyleChange,
  };
}
