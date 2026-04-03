/**
 * WebGLDetector Unit Tests
 * DR-568: US-TEST-031
 *
 * Tests: WebGL detection, fallback when unavailable,
 * texture creation test, getLimits, getMaxTextureSize.
 */

import WebGLDetector, { getWebGLDetector } from '../../../../dreamscape-frontend/panorama/src/services/WebGLDetector';

// Helper to create a mock WebGL context
function createMockGl(overrides = {}) {
  return {
    getParameter: jest.fn((param) => {
      const params = {
        3379: 8192,   // MAX_TEXTURE_SIZE
        34930: 16,    // MAX_TEXTURE_IMAGE_UNITS
        35661: 48,    // MAX_COMBINED_TEXTURE_IMAGE_UNITS
        7937: 'Mock GPU Renderer',
        7936: 'Mock GPU Vendor',
      };
      return params[param] || 0;
    }),
    createTexture: jest.fn(() => ({})),
    bindTexture: jest.fn(),
    texImage2D: jest.fn(),
    deleteTexture: jest.fn(),
    getError: jest.fn(() => 0),
    TEXTURE_2D: 3553,
    RGBA: 6408,
    UNSIGNED_BYTE: 5121,
    NO_ERROR: 0,
    MAX_TEXTURE_SIZE: 3379,
    MAX_TEXTURE_IMAGE_UNITS: 34930,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
    RENDERER: 7937,
    VENDOR: 7936,
    ...overrides,
  };
}

function mockCreateElementWithGl(gl) {
  const origCreate = document.createElement.bind(document);
  return jest.spyOn(document, 'createElement').mockImplementation((tag, ...args) => {
    const el = origCreate(tag, ...args);
    if (tag === 'canvas') {
      el.getContext = jest.fn((type) => {
        if (type === 'webgl' || type === 'experimental-webgl') return gl;
        return null;
      });
    }
    return el;
  });
}

describe('WebGLDetector (DR-568)', () => {
  let detector;

  beforeEach(() => {
    detector = new WebGLDetector();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default limits', () => {
      expect(detector.detectionComplete).toBe(false);
      expect(detector.limits.maxTextureSize).toBe(8192);
      expect(detector.limits.renderer).toBeNull();
      expect(detector.limits.vendor).toBeNull();
    });
  });

  describe('detect()', () => {
    it('should detect WebGL limits successfully', async () => {
      const spy = mockCreateElementWithGl(createMockGl());

      const freshDetector = new WebGLDetector();
      const result = await freshDetector.detect();

      expect(result.success).toBe(true);
      expect(result.maxTextureSize).toBeGreaterThan(0);
      expect(result.renderer).toBe('Mock GPU Renderer');
      expect(result.vendor).toBe('Mock GPU Vendor');
      expect(result.maxUnits).toBe(16);
      expect(result.maxCombined).toBe(48);
    });

    it('should mark detection as complete', async () => {
      mockCreateElementWithGl(createMockGl());
      const freshDetector = new WebGLDetector();
      await freshDetector.detect();
      expect(freshDetector.detectionComplete).toBe(true);
    });

    it('should store limits internally', async () => {
      mockCreateElementWithGl(createMockGl());
      const freshDetector = new WebGLDetector();
      await freshDetector.detect();
      expect(freshDetector.limits.renderer).toBe('Mock GPU Renderer');
      expect(freshDetector.limits.maxTextureSize).toBeGreaterThan(0);
    });

    it('should fallback to 2048 when WebGL unavailable', async () => {
      mockCreateElementWithGl(null);

      const freshDetector = new WebGLDetector();
      const result = await freshDetector.detect();

      expect(result.success).toBe(false);
      expect(result.maxTextureSize).toBe(2048);
      expect(result.reason).toContain('WebGL not available');
    });

    it('should use conservative size when texture test fails', async () => {
      mockCreateElementWithGl(createMockGl({
        getError: jest.fn(() => 1280), // GL_INVALID_ENUM
      }));

      const freshDetector = new WebGLDetector();
      const result = await freshDetector.detect();

      expect(result.success).toBe(true);
      expect(result.maxTextureSize).toBeLessThanOrEqual(4096);
    });

    it('should handle exception during texture test', async () => {
      mockCreateElementWithGl(createMockGl({
        texImage2D: jest.fn(() => { throw new Error('GL crash'); }),
      }));

      const freshDetector = new WebGLDetector();
      const result = await freshDetector.detect();

      expect(result.success).toBe(true);
      expect(result.maxTextureSize).toBe(4096);
    });
  });

  describe('_fallback()', () => {
    it('should set limits and mark detection complete', () => {
      const result = detector._fallback(2048, 'Test reason');

      expect(result.success).toBe(false);
      expect(result.maxTextureSize).toBe(2048);
      expect(result.reason).toBe('Test reason');
      expect(detector.detectionComplete).toBe(true);
      expect(detector.limits.maxTextureSize).toBe(2048);
    });
  });

  describe('getLimits()', () => {
    it('should trigger detection if not done', async () => {
      const limits = await detector.getLimits();
      expect(detector.detectionComplete).toBe(true);
      expect(limits.maxTextureSize).toBeGreaterThan(0);
    });

    it('should return cached limits on second call', async () => {
      await detector.getLimits();
      const spy = jest.spyOn(detector, 'detect');
      await detector.getLimits();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('getMaxTextureSize()', () => {
    it('should return max texture size', async () => {
      const size = await detector.getMaxTextureSize();
      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);
    });
  });

  describe('getWebGLDetector() singleton', () => {
    it('should return a WebGLDetector instance', () => {
      const instance = getWebGLDetector();
      expect(instance).toBeInstanceOf(WebGLDetector);
    });
  });
});
