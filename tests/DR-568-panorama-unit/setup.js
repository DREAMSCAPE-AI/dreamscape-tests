/**
 * DR-568 Test Setup
 * Mocks for Three.js, WebGL context, and browser APIs used by panorama service.
 */

// --- Mock WebGL context ---
const mockGl = {
  getParameter: jest.fn((param) => {
    const params = {
      3379: 8192,   // MAX_TEXTURE_SIZE
      34930: 16,    // MAX_TEXTURE_IMAGE_UNITS
      35661: 48,    // MAX_COMBINED_TEXTURE_IMAGE_UNITS
      7937: 'Mock GPU Renderer',  // RENDERER
      7936: 'Mock GPU Vendor',    // VENDOR
    };
    return params[param] || 0;
  }),
  createTexture: jest.fn(() => ({})),
  bindTexture: jest.fn(),
  texImage2D: jest.fn(),
  deleteTexture: jest.fn(),
  getError: jest.fn(() => 0), // NO_ERROR
  TEXTURE_2D: 3553,
  RGBA: 6408,
  UNSIGNED_BYTE: 5121,
  NO_ERROR: 0,
  MAX_TEXTURE_SIZE: 3379,
  MAX_TEXTURE_IMAGE_UNITS: 34930,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS: 35661,
  RENDERER: 7937,
  VENDOR: 7936,
};

// Override canvas getContext to return our mock
const originalCreateElement = document.createElement.bind(document);
jest.spyOn(document, 'createElement').mockImplementation((tag, ...args) => {
  const el = originalCreateElement(tag, ...args);
  if (tag === 'canvas') {
    el.getContext = jest.fn((type) => {
      if (type === 'webgl' || type === 'experimental-webgl') {
        return mockGl;
      }
      return null;
    });
  }
  return el;
});

// --- Mock URL.createObjectURL / revokeObjectURL ---
if (!global.URL.createObjectURL) {
  global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
}
if (!global.URL.revokeObjectURL) {
  global.URL.revokeObjectURL = jest.fn();
}
