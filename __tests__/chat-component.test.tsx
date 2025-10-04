/**
 * Chat component tests for tool message display
 * Tests that tool usage messages appear in chat instead of top status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chat } from '@/components/chat';

// Mock the Monaco editor
vi.mock('@monaco-editor/react', () => ({
  Editor: () => <div data-testid="monaco-editor">Mock Editor</div>,
}));

// Mock the edit suggestions hook
vi.mock('@/hooks/use-edit-suggestions', () => ({
  useEditSuggestions: () => ({
    editSuggestions: [],
    onEditSuggestion: vi.fn(),
    handleAcceptEdit: vi.fn(),
    handleRejectEdit: vi.fn(),
  }),
}));

// Mock the project context
vi.mock('@/app/context/project', () => ({
  useProject: () => ({
    project: { id: 'test-project' },
    file: { id: 'test-file', content: 'test content' },
  }),
}));

// Mock the Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  }),
}));

// Mock the OctreeLogo component
vi.mock('@/components/icons/octree-logo', () => ({
  OctreeLogo: () => <div data-testid="octree-logo">Octree Logo</div>,
}));

// Mock the Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

// Mock the Textarea component
vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ value, onChange, ...props }: any) => (
    <textarea value={value} onChange={onChange} {...props} />
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  ArrowUp: () => <span data-testid="arrow-up">↑</span>,
  Loader2: () => <span data-testid="loader">⟳</span>,
  StopCircle: () => <span data-testid="stop">⏹</span>,
  Maximize2: () => <span data-testid="maximize">⛶</span>,
  Minimize2: () => <span data-testid="minimize">⊟</span>,
  X: () => <span data-testid="close">✕</span>,
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock ReactMarkdown
vi.mock('react-markdown', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

// Mock LatexRenderer
vi.mock('@/components/latex-renderer', () => ({
  default: ({ children }: any) => <div data-testid="latex-renderer">{children}</div>,
}));

// Mock OctreeLogo
vi.mock('@/components/icons/octree-logo', () => ({
  OctreeLogo: () => <div data-testid="octree-logo">Octree</div>,
}));

// Mock Accordion components
vi.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }: any) => <div data-testid="accordion">{children}</div>,
  AccordionItem: ({ children }: any) => <div data-testid="accordion-item">{children}</div>,
  AccordionTrigger: ({ children }: any) => <button data-testid="accordion-trigger">{children}</button>,
  AccordionContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
}));

describe('Chat Component Tool Messages', () => {
  const mockOnEditSuggestion = vi.fn();
  const mockSetTextFromEditor = vi.fn();
  const mockSetIsMinimized = vi.fn();
  const mockSetIsOpen = vi.fn();

  const mockProps = {
    onEditSuggestion: mockOnEditSuggestion,
    fileContent: 'Test LaTeX content',
    textFromEditor: null,
    setTextFromEditor: mockSetTextFromEditor,
    selectionRange: null,
    isMinimized: false,
    setIsMinimized: mockSetIsMinimized,
    isOpen: true,
    setIsOpen: mockSetIsOpen,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock fetch for API calls
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: undefined }),
          }),
        },
      })
    );
  });

  describe('Tool Message Display', () => {
    it('should display tool usage messages in chat', async () => {
      // Mock a successful API response with tool events
      const mockStreamResponse = new ReadableStream({
        start(controller) {
          // Simulate tool event
          const toolEvent = `event: tool\ndata: {"name":"get_context"}\n\n`;
          controller.enqueue(new TextEncoder().encode(toolEvent));
          
          // Simulate another tool event
          const editEvent = `event: tool\ndata: {"name":"propose_edits","count":2}\n\n`;
          controller.enqueue(new TextEncoder().encode(editEvent));
          
          // Simulate done event
          const doneEvent = `event: done\ndata: {"text":"Task completed"}\n\n`;
          controller.enqueue(new TextEncoder().encode(doneEvent));
          
          controller.close();
        },
      });

      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          body: mockStreamResponse,
        })
      );

      render(<Chat {...mockProps} />);

      // Submit a test message
      const input = screen.getByPlaceholderText('Prompt to edit your document...');
      await userEvent.type(input, 'Test message');
      await userEvent.keyboard('{Enter}');

      // Wait for tool messages to appear
      await waitFor(() => {
        expect(screen.getByText('🔧 get_context')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('🔧 propose_edits (2 edits)')).toBeInTheDocument();
      });
    });

    it('should display tool messages with blocked edits information', async () => {
      const mockStreamResponse = new ReadableStream({
        start(controller) {
          const toolEvent = `event: tool\ndata: {"name":"propose_edits","count":1,"violations":["Blocked edit"]}\n\n`;
          controller.enqueue(new TextEncoder().encode(toolEvent));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          body: mockStreamResponse,
        })
      );

      render(<Chat {...mockProps} />);

      const input = screen.getByPlaceholderText('Prompt to edit your document...');
      await userEvent.type(input, 'Test message');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('🔧 propose_edits (1 edits) - 1 blocked')).toBeInTheDocument();
      });
    });

    it('should not display tool status at the top', async () => {
      render(<Chat {...mockProps} />);

      // Check that there's no tool status badge at the top
      const toolStatusBadge = screen.queryByText(/tool|status/i);
      expect(toolStatusBadge).not.toBeInTheDocument();
    });
  });

  describe('Chat Message Flow', () => {
    it('should display user messages correctly', async () => {
      render(<Chat {...mockProps} />);

      const input = screen.getByPlaceholderText('Prompt to edit your document...');
      await userEvent.type(input, 'Add a new section');
      await userEvent.keyboard('{Enter}');

      expect(screen.getByText('Add a new section')).toBeInTheDocument();
    });

    it('should handle assistant responses', async () => {
      const mockStreamResponse = new ReadableStream({
        start(controller) {
          const assistantEvent = `event: assistant_message\ndata: {"text":"I'll help you add a new section."}\n\n`;
          controller.enqueue(new TextEncoder().encode(assistantEvent));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          body: mockStreamResponse,
        })
      );

      render(<Chat {...mockProps} />);

      const input = screen.getByPlaceholderText('Prompt to edit your document...');
      await userEvent.type(input, 'Add a new section');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText("I'll help you add a new section.")).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        })
      );

      render(<Chat {...mockProps} />);

      const input = screen.getByPlaceholderText('Prompt to edit your document...');
      await userEvent.type(input, 'Test message');
      await userEvent.keyboard('{Enter}');

      // Should not crash and should handle error gracefully
      await waitFor(() => {
        expect(screen.getByText('Test message')).toBeInTheDocument();
      });
    });

    it('should handle malformed tool events', async () => {
      const mockStreamResponse = new ReadableStream({
        start(controller) {
          // Malformed tool event
          const malformedEvent = `event: tool\ndata: {"name":"tool"}\n\n`;
          controller.enqueue(new TextEncoder().encode(malformedEvent));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          body: mockStreamResponse,
        })
      );

      render(<Chat {...mockProps} />);

      const input = screen.getByPlaceholderText('Prompt to edit your document...');
      await userEvent.type(input, 'Test message');
      await userEvent.keyboard('{Enter}');

      // Should handle malformed events gracefully
      await waitFor(() => {
        expect(screen.getByText('🔧 tool')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during API calls', async () => {
      // Mock a delayed response to keep loading state active
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              body: {
                getReader: () => ({
                  read: () => Promise.resolve({ done: true, value: undefined }),
                }),
              },
            });
          }, 100);
        })
      );

      render(<Chat {...mockProps} />);

      const input = screen.getByPlaceholderText('Prompt to edit your document...');
      await userEvent.type(input, 'Test message');
      await userEvent.keyboard('{Enter}');

      // Should show loading indicator immediately after submit
      expect(screen.getAllByTestId('loader')).toHaveLength(2);
    });

    it('should allow canceling requests', async () => {
      // Mock a delayed response to keep loading state active
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              body: {
                getReader: () => ({
                  read: () => Promise.resolve({ done: true, value: undefined }),
                }),
              },
            });
          }, 100);
        })
      );

      render(<Chat {...mockProps} />);

      const input = screen.getByPlaceholderText('Prompt to edit your document...');
      await userEvent.type(input, 'Test message');
      await userEvent.keyboard('{Enter}');

      // Should show stop button
      expect(screen.getByTestId('stop')).toBeInTheDocument();
    });
  });
});
