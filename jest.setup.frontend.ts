/**
 * Frontend-specific Jest setup
 * Loaded via setupFilesAfterEnv in jest.config.frontend.js
 *
 * - @testing-library/jest-dom matchers
 * - localStorage / sessionStorage mocks
 * - window.location mock
 * - import.meta.env polyfill for Vite-compiled modules
 */

import '@testing-library/jest-dom';

// ─── import.meta.env polyfill ────────────────────────────────────────────────
// Vite replaces import.meta.env.* at build time. In Jest (Node) we need to
// provide the same values so any module that isn't mocked can still load.
(global as any).__importMetaEnv = {
  VITE_AUTH_SERVICE_URL: 'http://localhost:3001',
  VITE_USER_SERVICE_URL: 'http://localhost:3002',
  VITE_VOYAGE_SERVICE_URL: 'http://localhost:3003',
  VITE_PAYMENT_SERVICE_URL: 'http://localhost:3004',
  VITE_AI_SERVICE_URL: 'http://localhost:3005',
  VITE_API_BASE_URL: 'http://localhost:3003',
  VITE_GATEWAY_URL: 'http://localhost:4000',
  MODE: 'test',
  DEV: false,
  PROD: false,
  SSR: false,
};

// ─── localStorage / sessionStorage ───────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: jest.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

// Only set up DOM globals in jsdom environment
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: localStorageMock,
    writable: true,
  });

  // ─── window.location ───────────────────────────────────────────────────────
  // jsdom already defines location as non-configurable; patch only if possible
  try {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/', pathname: '/', assign: jest.fn(), replace: jest.fn() },
      writable: true,
      configurable: true,
    });
  } catch {
    // Already defined by jsdom — that's fine, tests use jest.mock('react-router-dom') instead
  }

  // ─── window.URL.createObjectURL ────────────────────────────────────────────
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = jest.fn();
  }

  // ─── matchMedia (Tailwind / responsive) ────────────────────────────────────
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// ─── Reset localStorage mock between tests ───────────────────────────────────
beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});
