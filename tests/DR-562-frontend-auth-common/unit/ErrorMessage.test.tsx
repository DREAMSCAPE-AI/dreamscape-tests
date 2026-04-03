/**
 * DR-562 — US-TEST-025
 * Tests unitaires : ErrorMessage (components/common)
 *
 * @jest-environment jsdom
 * @ticket DR-562
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mock lucide-react icons (ESM-safe) ───────────────────────────────────────
jest.mock('lucide-react', () => ({
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  Loader2: () => <span data-testid="icon-loader" />,
}));

import ErrorMessage from '../../../../dreamscape-frontend/web-client/src/components/common/ErrorMessage';

// ─────────────────────────────────────────────────────────────────────────────

describe('ErrorMessage', () => {
  describe('Rendering', () => {
    it('renders the error message passed as prop', () => {
      render(<ErrorMessage message="Something failed" />);
      expect(screen.getByText('Something failed')).toBeInTheDocument();
    });

    it('renders the static title "Something went wrong"', () => {
      render(<ErrorMessage message="Any error" />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders the alert icon container', () => {
      const { container } = render(<ErrorMessage message="Error" />);
      expect(container.querySelector('.bg-red-100')).toBeInTheDocument();
    });

    it('renders the AlertCircle icon', () => {
      render(<ErrorMessage message="Error" />);
      expect(screen.getByTestId('icon-alert-circle')).toBeInTheDocument();
    });
  });

  describe('Retry Button', () => {
    it('does NOT render retry button when onRetry is absent', () => {
      render(<ErrorMessage message="Error" />);
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('renders retry button when onRetry is provided', () => {
      render(<ErrorMessage message="Error" onRetry={jest.fn()} />);
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('calls onRetry once when button is clicked', () => {
      const mockRetry = jest.fn();
      render(<ErrorMessage message="Error" onRetry={mockRetry} />);
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry on each subsequent click', () => {
      const mockRetry = jest.fn();
      render(<ErrorMessage message="Error" onRetry={mockRetry} />);
      const btn = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(btn);
      fireEvent.click(btn);
      fireEvent.click(btn);
      expect(mockRetry).toHaveBeenCalledTimes(3);
    });

    it('renders the RefreshCw icon inside the retry button', () => {
      render(<ErrorMessage message="Error" onRetry={jest.fn()} />);
      expect(screen.getByTestId('icon-refresh')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className to root element', () => {
      const { container } = render(<ErrorMessage message="Error" className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('has default layout classes without explicit className', () => {
      const { container } = render(<ErrorMessage message="Error" />);
      expect(container.firstChild).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
    });
  });

  describe('Message variations', () => {
    it('displays different messages without mixing them', () => {
      const { rerender } = render(<ErrorMessage message="First error" />);
      expect(screen.getByText('First error')).toBeInTheDocument();

      rerender(<ErrorMessage message="Second error" />);
      expect(screen.getByText('Second error')).toBeInTheDocument();
      expect(screen.queryByText('First error')).not.toBeInTheDocument();
    });

    it('displays long messages without truncation', () => {
      const longMsg = 'A'.repeat(300);
      render(<ErrorMessage message={longMsg} />);
      expect(screen.getByText(longMsg)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('retry button is accessible by role and name', () => {
      render(<ErrorMessage message="Error" onRetry={jest.fn()} />);
      const btn = screen.getByRole('button', { name: /try again/i });
      expect(btn).toBeInTheDocument();
    });

    it('error message text is visible in the document', () => {
      render(<ErrorMessage message="Visible error text" />);
      expect(screen.getByText('Visible error text')).toBeVisible();
    });
  });
});
