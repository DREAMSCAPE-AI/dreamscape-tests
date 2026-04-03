/**
 * DR-562 — US-TEST-025
 * Tests unitaires : LoadingSpinner (components/common)
 *
 * @jest-environment jsdom
 * @ticket DR-562
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  Loader2: ({ className }: { className?: string }) => (
    <span data-testid="icon-loader" className={className} />
  ),
  AlertCircle: () => <span data-testid="icon-alert" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
}));

import LoadingSpinner from '../../../../dreamscape-frontend/web-client/src/components/common/LoadingSpinner';

// ─────────────────────────────────────────────────────────────────────────────

describe('LoadingSpinner', () => {
  describe('Default rendering', () => {
    it('renders without text by default', () => {
      render(<LoadingSpinner />);
      expect(screen.queryByText(/.+/)).not.toBeInTheDocument();
    });

    it('renders the Loader2 icon', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('icon-loader')).toBeInTheDocument();
    });

    it('has animate-spin class on the icon', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('icon-loader')).toHaveClass('animate-spin');
    });

    it('applies medium size classes by default (w-8 h-8)', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('icon-loader')).toHaveClass('w-8', 'h-8');
    });
  });

  describe('Size prop', () => {
    it('applies small size classes (w-4 h-4)', () => {
      render(<LoadingSpinner size="small" />);
      expect(screen.getByTestId('icon-loader')).toHaveClass('w-4', 'h-4');
    });

    it('applies large size classes (w-12 h-12)', () => {
      render(<LoadingSpinner size="large" />);
      expect(screen.getByTestId('icon-loader')).toHaveClass('w-12', 'h-12');
    });

    it('applies medium size classes when size="medium"', () => {
      render(<LoadingSpinner size="medium" />);
      expect(screen.getByTestId('icon-loader')).toHaveClass('w-8', 'h-8');
    });
  });

  describe('Text prop', () => {
    it('renders text when provided', () => {
      render(<LoadingSpinner text="Loading your data..." />);
      expect(screen.getByText('Loading your data...')).toBeInTheDocument();
    });

    it('does NOT render any text element when text is absent', () => {
      const { container } = render(<LoadingSpinner />);
      expect(container.querySelector('p')).not.toBeInTheDocument();
    });

    it('renders text with correct styling', () => {
      render(<LoadingSpinner text="Please wait" />);
      const textEl = screen.getByText('Please wait');
      expect(textEl).toHaveClass('text-sm', 'text-gray-600');
    });
  });

  describe('className prop', () => {
    it('applies custom className to the root element', () => {
      const { container } = render(<LoadingSpinner className="my-spinner" />);
      expect(container.firstChild).toHaveClass('my-spinner');
    });

    it('keeps default layout classes alongside custom className', () => {
      const { container } = render(<LoadingSpinner className="my-spinner" />);
      expect(container.firstChild).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
    });
  });

  describe('Icon colour', () => {
    it('applies text-orange-500 to the spinner icon', () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId('icon-loader')).toHaveClass('text-orange-500');
    });
  });
});
