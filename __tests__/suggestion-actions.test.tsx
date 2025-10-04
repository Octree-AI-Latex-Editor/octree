/**
 * UI Component tests for edit suggestions
 * Tests the ACCEPT/REJECT functionality and display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SuggestionActions } from '@/components/editor/suggestion-actions';
import { EditSuggestion } from '@/types/edit';

// Mock the DiffViewer component
vi.mock('@/components/ui/diff-viewer', () => ({
  DiffViewer: ({ original, suggested, className }: any) => (
    <div data-testid="diff-viewer" className={className}>
      <div data-testid="original">{original}</div>
      <div data-testid="suggested">{suggested}</div>
    </div>
  ),
}));

// Mock the Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: any) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon">✓</span>,
  X: () => <span data-testid="x-icon">✗</span>,
}));

describe('SuggestionActions Component', () => {
  const mockOnAccept = vi.fn();
  const mockOnReject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Insert Operations', () => {
    it('should display insert operations correctly', () => {
      const insertSuggestion: EditSuggestion = {
        id: 'insert-1',
        editType: 'insert',
        position: { line: 10 },
        content: 'New content here',
        originalLineCount: 0,
        status: 'pending',
      };

      render(
        <SuggestionActions
          suggestions={[insertSuggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText('Lines 10')).toBeInTheDocument();
      expect(screen.getByTestId('original')).toHaveTextContent('');
      expect(screen.getByTestId('suggested')).toHaveTextContent('New content here');
      expect(screen.getByText('Accept')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    it('should handle accept action for insert operations', () => {
      const insertSuggestion: EditSuggestion = {
        id: 'insert-1',
        editType: 'insert',
        position: { line: 10 },
        content: 'New content here',
        originalLineCount: 0,
        status: 'pending',
      };

      render(
        <SuggestionActions
          suggestions={[insertSuggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText('Accept'));
      expect(mockOnAccept).toHaveBeenCalledWith('insert-1');
      expect(mockOnReject).not.toHaveBeenCalled();
    });

    it('should handle reject action for insert operations', () => {
      const insertSuggestion: EditSuggestion = {
        id: 'insert-1',
        editType: 'insert',
        position: { line: 10 },
        content: 'New content here',
        originalLineCount: 0,
        status: 'pending',
      };

      render(
        <SuggestionActions
          suggestions={[insertSuggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText('Reject'));
      expect(mockOnReject).toHaveBeenCalledWith('insert-1');
      expect(mockOnAccept).not.toHaveBeenCalled();
    });
  });

  describe('Delete Operations', () => {
    it('should display delete operations correctly with DELETE label', () => {
      const deleteSuggestion: EditSuggestion = {
        id: 'delete-1',
        editType: 'delete',
        position: { line: 10 },
        originalLineCount: 3,
        original: 'Content to be deleted\nLine 2\nLine 3',
        status: 'pending',
      };

      render(
        <SuggestionActions
          suggestions={[deleteSuggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText('Lines 10-12')).toBeInTheDocument();
      expect(screen.getByText('(DELETE)')).toBeInTheDocument();
      expect(screen.getByTestId('original')).toHaveTextContent('Content to be deleted Line 2 Line 3');
      expect(screen.getByTestId('suggested')).toHaveTextContent('');
    });

    it('should handle accept action for delete operations', () => {
      const deleteSuggestion: EditSuggestion = {
        id: 'delete-1',
        editType: 'delete',
        position: { line: 10 },
        originalLineCount: 2,
        original: 'Content to delete',
        status: 'pending',
      };

      render(
        <SuggestionActions
          suggestions={[deleteSuggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText('Accept'));
      expect(mockOnAccept).toHaveBeenCalledWith('delete-1');
    });

    it('should handle reject action for delete operations', () => {
      const deleteSuggestion: EditSuggestion = {
        id: 'delete-1',
        editType: 'delete',
        position: { line: 10 },
        originalLineCount: 2,
        original: 'Content to delete',
        status: 'pending',
      };

      render(
        <SuggestionActions
          suggestions={[deleteSuggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText('Reject'));
      expect(mockOnReject).toHaveBeenCalledWith('delete-1');
    });
  });

  describe('Replace Operations', () => {
    it('should display replace operations correctly', () => {
      const replaceSuggestion: EditSuggestion = {
        id: 'replace-1',
        editType: 'replace',
        position: { line: 10 },
        content: 'New content',
        originalLineCount: 1,
        original: 'Old content',
        status: 'pending',
      };

      render(
        <SuggestionActions
          suggestions={[replaceSuggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText('Lines 10')).toBeInTheDocument();
      expect(screen.getByTestId('original')).toHaveTextContent('Old content');
      expect(screen.getByTestId('suggested')).toHaveTextContent('New content');
    });

    it('should handle accept action for replace operations', () => {
      const replaceSuggestion: EditSuggestion = {
        id: 'replace-1',
        editType: 'replace',
        position: { line: 10 },
        content: 'New content',
        originalLineCount: 1,
        original: 'Old content',
        status: 'pending',
      };

      render(
        <SuggestionActions
          suggestions={[replaceSuggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      fireEvent.click(screen.getByText('Accept'));
      expect(mockOnAccept).toHaveBeenCalledWith('replace-1');
    });
  });

  describe('Legacy Edit Suggestions', () => {
    it('should display legacy edit suggestions correctly', () => {
      const legacySuggestion: EditSuggestion = {
        id: 'legacy-1',
        startLine: 10,
        originalLineCount: 2,
        suggested: 'New suggested content',
        original: 'Original content',
        status: 'pending',
      } as any;

      render(
        <SuggestionActions
          suggestions={[legacySuggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText('Lines 10-11')).toBeInTheDocument();
      expect(screen.getByTestId('original')).toHaveTextContent('Original content');
      expect(screen.getByTestId('suggested')).toHaveTextContent('New suggested content');
    });
  });

  describe('Multiple Suggestions', () => {
    it('should display multiple suggestions correctly', () => {
      const suggestions: EditSuggestion[] = [
        {
          id: 'insert-1',
          editType: 'insert',
          position: { line: 5 },
          content: 'Insert content',
          originalLineCount: 0,
          status: 'pending',
        },
        {
          id: 'delete-1',
          editType: 'delete',
          position: { line: 10 },
          originalLineCount: 2,
          original: 'Delete content',
          status: 'pending',
        },
        {
          id: 'replace-1',
          editType: 'replace',
          position: { line: 15 },
          content: 'Replace content',
          originalLineCount: 1,
          original: 'Old content',
          status: 'pending',
        },
      ];

      render(
        <SuggestionActions
          suggestions={suggestions}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText('Lines 5')).toBeInTheDocument();
      expect(screen.getByText('Lines 10-11')).toBeInTheDocument();
      expect(screen.getByText('Lines 15')).toBeInTheDocument();
      expect(screen.getByText('(DELETE)')).toBeInTheDocument();
      expect(screen.getAllByText('Accept')).toHaveLength(3);
      expect(screen.getAllByText('Reject')).toHaveLength(3);
    });

    it('should handle actions for multiple suggestions independently', () => {
      const suggestions: EditSuggestion[] = [
        {
          id: 'insert-1',
          editType: 'insert',
          position: { line: 5 },
          content: 'Insert content',
          originalLineCount: 0,
          status: 'pending',
        },
        {
          id: 'delete-1',
          editType: 'delete',
          position: { line: 10 },
          originalLineCount: 1,
          original: 'Delete content',
          status: 'pending',
        },
      ];

      render(
        <SuggestionActions
          suggestions={suggestions}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      // Accept the first suggestion
      fireEvent.click(screen.getAllByText('Accept')[0]);
      expect(mockOnAccept).toHaveBeenCalledWith('insert-1');

      // Reject the second suggestion
      fireEvent.click(screen.getAllByText('Reject')[1]);
      expect(mockOnReject).toHaveBeenCalledWith('delete-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty suggestions array', () => {
      render(
        <SuggestionActions
          suggestions={[]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      expect(screen.queryByText('Accept')).not.toBeInTheDocument();
      expect(screen.queryByText('Reject')).not.toBeInTheDocument();
    });

    it('should only show pending suggestions', () => {
      const suggestions: EditSuggestion[] = [
        {
          id: 'pending-1',
          editType: 'insert',
          position: { line: 5 },
          content: 'Pending content',
          originalLineCount: 0,
          status: 'pending',
        },
        {
          id: 'accepted-1',
          editType: 'insert',
          position: { line: 10 },
          content: 'Accepted content',
          originalLineCount: 0,
          status: 'accepted',
        },
        {
          id: 'rejected-1',
          editType: 'insert',
          position: { line: 15 },
          content: 'Rejected content',
          originalLineCount: 0,
          status: 'rejected',
        },
      ];

      render(
        <SuggestionActions
          suggestions={suggestions}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText('Lines 5')).toBeInTheDocument();
      expect(screen.queryByText('Lines 10')).not.toBeInTheDocument();
      expect(screen.queryByText('Lines 15')).not.toBeInTheDocument();
      expect(screen.getAllByText('Accept')).toHaveLength(1);
      expect(screen.getAllByText('Reject')).toHaveLength(1);
    });

    it('should handle suggestions with missing fields gracefully', () => {
      const suggestion: EditSuggestion = {
        id: 'incomplete-1',
        editType: 'insert',
        // Missing position
        content: 'Content without position',
        originalLineCount: 0,
        status: 'pending',
      };

      render(
        <SuggestionActions
          suggestions={[suggestion]}
          onAccept={mockOnAccept}
          onReject={mockOnReject}
        />
      );

      expect(screen.getByText('Lines 1')).toBeInTheDocument(); // Default fallback
      expect(screen.getByTestId('suggested')).toHaveTextContent('Content without position');
    });
  });
});
