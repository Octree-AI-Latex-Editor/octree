/**
 * Intent inference using pattern matching
 * Determines what edit operations the user wants to perform
 */

export interface IntentResult {
  // Basic edit operations
  allowInsert: boolean;
  allowDelete: boolean;
  allowReplace: boolean;
  
  // Special operation flags
  wantsGrammar: boolean;
  wantsDedupe: boolean;
  isReadOnly: boolean;
  multiEdit: boolean;
  fullRevamp: boolean;
}

/**
 * Pattern matching - Define patterns as structured objects
 */
const patterns = {
  // Insert operations
  insert: {
    verbs: ['insert', 'add', 'append', 'create', 'new', 'include', 'incorporate'],
    match: (t: string) => patterns.insert.verbs.some(v => t.includes(v))
  },
  
  // Delete operations
  delete: {
    verbs: ['delete', 'remove', 'strip', 'drop', 'eliminate'],
    match: (t: string) => patterns.delete.verbs.some(v => t.includes(v))
  },
  
  // Replace operations
  replace: {
    verbs: ['replace', 'substitute', 'swap', 'exchange', 'change', 'modify', 'adjust', 'tweak', 'revise', 'correct', 'fix', 'improve', 'enhance'],
    match: (t: string) => patterns.replace.verbs.some(v => t.includes(v))
  },
  
  // Grammar and spelling
  grammar: {
    keywords: ['grammar', 'proofread', 'typo', 'spelling', 'punctuation', 'capitalize'],
    match: (t: string) => patterns.grammar.keywords.some(k => t.includes(k))
  },
  
  // Deduplication
  dedupe: {
    keywords: ['dedup', 'de-dup', 'duplicate', 'remove duplicates', 'duplicates'],
    match: (t: string) => patterns.dedupe.keywords.some(k => t.includes(k))
  },
  
  // Multi-edit indicators
  multi: {
    keywords: ['multi', 'multiple', 'several', 'batch', 'all', 'every'],
    match: (t: string) => patterns.multi.keywords.some(k => t.includes(k))
  },
  
  // Full revamp
  full: {
    keywords: ['complete revamp', 'rewrite everything', 'from scratch', 'restructure entire'],
    match: (t: string) => patterns.full.keywords.some(k => t.includes(k))
  },
  
  // Restriction patterns
  explicitRestriction: {
    patterns: [
      { prefix: 'only', actions: ['read', 'view', 'check', 'examine', 'review', 'look', 'see'] },
      { prefix: 'just', actions: ['read', 'view', 'check', 'examine', 'review', 'look', 'see'] },
    ],
    match: (t: string) => patterns.explicitRestriction.patterns.some(p => 
      p.actions.some(a => t.includes(`${p.prefix} ${a}`))
    )
  },
  
  negativeRestriction: {
    patterns: [
      { prefix: "don't", actions: ['edit', 'modify', 'change', 'alter', 'update', 'delete', 'remove', 'add', 'insert'] },
      { prefix: 'do not', actions: ['edit', 'modify', 'change', 'alter', 'update', 'delete', 'remove', 'add', 'insert'] },
      { prefix: 'no', actions: ['edit', 'modifications', 'changes'] },
    ],
    match: (t: string) => patterns.negativeRestriction.patterns.some(p => 
      p.actions.some(a => t.includes(`${p.prefix} ${a}`))
    )
  },
  
  readOnlyIntent: {
    readActions: ['read', 'view', 'check', 'examine', 'review', 'look', 'see', 'show', 'display', 'inspect', 'analyze'],
    editActions: ['edit', 'modify', 'change', 'fix', 'correct', 'improve', 'add', 'remove', 'delete', 'insert', 'create'],
    match: (t: string) => {
      const hasReadAction = patterns.readOnlyIntent.readActions.some(a => t.includes(a));
      const hasEditAction = patterns.readOnlyIntent.editActions.some(a => t.includes(a));
      return hasReadAction && !hasEditAction;
    }
  }
};

/**
 * Infer user intent from text using pattern matching
 * Non-blocking version using setImmediate
 * @param userText - The user's input text
 * @returns Promise resolving to IntentResult with permission flags
 */
export async function inferIntent(userText: string): Promise<IntentResult> {
  return new Promise((resolve) => {
    // Use setImmediate to avoid blocking the event loop
    setImmediate(() => {
      const text = (userText || '').toLowerCase();
      
      // Execute pattern matching
      const wantsInsert = patterns.insert.match(text);
      const wantsDelete = patterns.delete.match(text);
      const wantsReplace = patterns.replace.match(text);
      const wantsGrammar = patterns.grammar.match(text);
      const wantsDedupe = patterns.dedupe.match(text);
      const wantsMulti = patterns.multi.match(text);
      const wantsFull = patterns.full.match(text);
      
      const hasExplicitRestriction = patterns.explicitRestriction.match(text);
      const hasNegativeRestriction = patterns.negativeRestriction.match(text);
      const hasReadOnlyIntent = patterns.readOnlyIntent.match(text);
      
      // Default to allowing operations unless explicitly restricted
      const allowOperations = !hasExplicitRestriction && !hasNegativeRestriction && !hasReadOnlyIntent;
      
      resolve({
        // Basic operations - allow by default unless restricted
        allowInsert: allowOperations,
        allowDelete: allowOperations,
        allowReplace: allowOperations,
        
        // Special flags
        wantsGrammar,
        wantsDedupe,
        isReadOnly: hasReadOnlyIntent || hasExplicitRestriction || hasNegativeRestriction,
        multiEdit: wantsMulti || wantsFull || wantsInsert || wantsReplace,
        fullRevamp: wantsFull,
      });
    });
  });
}
