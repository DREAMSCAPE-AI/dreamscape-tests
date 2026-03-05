/**
 * @jest-environment jsdom
 */

/**
 * useWebXRDetection Hook Tests
 * DR-575: WebXR Detection & Fallback
 */

import { renderHook, waitFor } from '@testing-library/react';
import useWebXRDetection from '../../../../dreamscape-frontend/panorama/src/hooks/useWebXRDetection';

// Save original navigator.xr
const originalXR = navigator.xr;

afterEach(() => {
  // Restore navigator.xr
  Object.defineProperty(navigator, 'xr', {
    value: originalXR,
    writable: true,
    configurable: true,
  });
});

describe('useWebXRDetection (DR-575)', () => {
  it('starts with isChecking=true', () => {
    Object.defineProperty(navigator, 'xr', {
      value: { isSessionSupported: jest.fn(() => new Promise(() => {})) },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useWebXRDetection());

    expect(result.current.isChecking).toBe(true);
  });

  it('returns no-webxr-api when navigator.xr is missing', async () => {
    Object.defineProperty(navigator, 'xr', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useWebXRDetection());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isXRSupported).toBe(false);
    expect(result.current.xrReason).toBe('no-webxr-api');
  });

  it('returns supported when immersive-vr is available', async () => {
    Object.defineProperty(navigator, 'xr', {
      value: { isSessionSupported: jest.fn().mockResolvedValue(true) },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useWebXRDetection());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isXRSupported).toBe(true);
    expect(result.current.xrReason).toBe('supported');
  });

  it('returns no-headset when immersive-vr is not supported', async () => {
    Object.defineProperty(navigator, 'xr', {
      value: { isSessionSupported: jest.fn().mockResolvedValue(false) },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useWebXRDetection());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isXRSupported).toBe(false);
    expect(result.current.xrReason).toBe('no-headset');
  });

  it('returns error when isSessionSupported throws', async () => {
    Object.defineProperty(navigator, 'xr', {
      value: { isSessionSupported: jest.fn().mockRejectedValue(new Error('fail')) },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useWebXRDetection());

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });

    expect(result.current.isXRSupported).toBe(false);
    expect(result.current.xrReason).toBe('error');
  });

  it('sets isChecking=false after detection completes', async () => {
    Object.defineProperty(navigator, 'xr', {
      value: { isSessionSupported: jest.fn().mockResolvedValue(true) },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useWebXRDetection());

    // Initially checking
    expect(result.current.isChecking).toBe(true);

    await waitFor(() => {
      expect(result.current.isChecking).toBe(false);
    });
  });
});
