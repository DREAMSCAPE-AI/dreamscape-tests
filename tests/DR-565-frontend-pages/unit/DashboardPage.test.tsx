/**
 * DR-565 — US-TEST-028
 * Tests unitaires : DashboardPage (pages/dashboard/index.tsx)
 *
 * Scénarios couverts :
 * - Non authentifié → Navigate vers /auth
 * - Authentifié, user.type=undefined → UserDashboard
 * - Authentifié, user.type=business → BusinessDashboard
 * - Authentifié, user.type=leisure → LeisureDashboard
 * - Authentifié, user.type=bleisure → BleisureDashboard
 *
 * @jest-environment jsdom
 * @ticket DR-565
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
let mockIsAuthenticated = false;
let mockUser: any = null;

jest.mock('@/services/auth/AuthService', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated, user: mockUser }),
}));

jest.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('@/components/dashboard/UserDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="user-dashboard" />,
}));
jest.mock('@/components/business/BusinessDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="business-dashboard" />,
}));
jest.mock('@/components/leisure/LeisureDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="leisure-dashboard" />,
}));
jest.mock('@/components/bleisure/BleisureDashboard', () => ({
  __esModule: true,
  default: () => <div data-testid="bleisure-dashboard" />,
}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/pages/dashboard/index';

// ─────────────────────────────────────────────────────────────────────────────

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = false;
    mockUser = null;
  });

  it('redirects to /auth when not authenticated', () => {
    render(<DashboardPage />);
    const nav = screen.getByTestId('navigate');
    expect(nav).toHaveAttribute('data-to', '/auth');
  });

  it('renders UserDashboard for authenticated user without type', () => {
    mockIsAuthenticated = true;
    mockUser = { id: 'u1', type: undefined };
    render(<DashboardPage />);
    expect(screen.getByTestId('user-dashboard')).toBeInTheDocument();
  });

  it('renders BusinessDashboard for business user', () => {
    mockIsAuthenticated = true;
    mockUser = { id: 'u1', type: 'business' };
    render(<DashboardPage />);
    expect(screen.getByTestId('business-dashboard')).toBeInTheDocument();
  });

  it('renders LeisureDashboard for leisure user', () => {
    mockIsAuthenticated = true;
    mockUser = { id: 'u1', type: 'leisure' };
    render(<DashboardPage />);
    expect(screen.getByTestId('leisure-dashboard')).toBeInTheDocument();
  });

  it('renders BleisureDashboard for bleisure user', () => {
    mockIsAuthenticated = true;
    mockUser = { id: 'u1', type: 'bleisure' };
    render(<DashboardPage />);
    expect(screen.getByTestId('bleisure-dashboard')).toBeInTheDocument();
  });
});
