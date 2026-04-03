/**
 * TextureLoader Unit Tests
 * DR-568: US-TEST-031
 *
 * Tests: load, loadWithRetry, preloadTextures, cancelAll, dispose,
 * duplicate load prevention, progress callbacks, error handling.
 */

// Mock THREE before importing
jest.mock('three', () => {
  const mockTexture = {
    uuid: 'mock-uuid',
    image: { width: 1024, height: 512, complete: true },
    minFilter: null,
    magFilter: null,
    wrapS: null,
    wrapT: null,
    needsUpdate: false,
    dispose: jest.fn(),
  };

  const mockLoader = {
    load: jest.fn(),
  };

  return {
    TextureLoader: jest.fn(() => mockLoader),
    LinearFilter: 1006,
    RepeatWrapping: 1000,
    ClampToEdgeWrapping: 1001,
    __mockLoader: mockLoader,
    __mockTexture: mockTexture,
  };
});

import TextureLoader, { getTextureLoader } from '../../../../dreamscape-frontend/panorama/src/services/TextureLoader';
import * as THREE from 'three';

const mockLoader = THREE.__mockLoader;
const mockTexture = THREE.__mockTexture;

describe('TextureLoader (DR-568)', () => {
  let loader;

  beforeEach(() => {
    loader = new TextureLoader();
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();

    // Default: load succeeds (async to match real behavior)
    mockLoader.load.mockImplementation((url, onSuccess) => {
      Promise.resolve().then(() => onSuccess({ ...mockTexture }));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('load()', () => {
    it('should load a texture and resolve', async () => {
      const texture = await loader.load('http://img.com/pano.jpg');

      expect(texture).toBeDefined();
      expect(texture.uuid).toBe('mock-uuid');
      expect(mockLoader.load).toHaveBeenCalledWith(
        'http://img.com/pano.jpg',
        expect.any(Function),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should configure texture filters and wrapping', async () => {
      const texture = await loader.load('http://img.com/pano.jpg');

      expect(texture.minFilter).toBe(THREE.LinearFilter);
      expect(texture.magFilter).toBe(THREE.LinearFilter);
      expect(texture.wrapS).toBe(THREE.RepeatWrapping);
      expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
      expect(texture.needsUpdate).toBe(true);
    });

    it('should call onSuccess callback', async () => {
      const onSuccess = jest.fn();
      await loader.load('http://img.com/pano.jpg', { onSuccess });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('should reject if texture has no image data', async () => {
      mockLoader.load.mockImplementation((url, onSuccess) => {
        Promise.resolve().then(() => onSuccess({ uuid: 'bad', image: null }));
      });

      await expect(loader.load('http://img.com/bad.jpg')).rejects.toThrow('image');
    });

    it('should call onError when texture has no image', async () => {
      mockLoader.load.mockImplementation((url, onSuccess) => {
        Promise.resolve().then(() => onSuccess({ uuid: 'bad', image: null }));
      });
      const onError = jest.fn();

      await expect(loader.load('http://img.com/bad2.jpg', { onError })).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });

    it('should reject on load error', async () => {
      mockLoader.load.mockImplementation((url, _onSuccess, _onProgress, onError) => {
        Promise.resolve().then(() => onError(new Error('Network error')));
      });

      await expect(loader.load('http://img.com/fail.jpg')).rejects.toThrow('Network error');
    });

    it('should call onError callback on failure', async () => {
      mockLoader.load.mockImplementation((url, _s, _p, onError) => {
        Promise.resolve().then(() => onError(new Error('Network error')));
      });
      const onError = jest.fn();

      await expect(loader.load('http://img.com/fail2.jpg', { onError })).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });

    it('should call onProgress with computable progress', async () => {
      mockLoader.load.mockImplementation((url, onSuccess, onProgress) => {
        onProgress({ lengthComputable: true, loaded: 500000, total: 1000000 });
        Promise.resolve().then(() => onSuccess({ ...mockTexture }));
      });
      const onProgress = jest.fn();

      await loader.load('http://img.com/progress1.jpg', { onProgress });

      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        percent: 50,
        loaded: 500000,
        total: 1000000,
      }));
    });

    it('should handle non-computable progress', async () => {
      mockLoader.load.mockImplementation((url, onSuccess, onProgress) => {
        onProgress({ lengthComputable: false, loaded: 500000 });
        Promise.resolve().then(() => onSuccess({ ...mockTexture }));
      });
      const onProgress = jest.fn();

      await loader.load('http://img.com/progress2.jpg', { onProgress });

      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({
        percent: null,
        loaded: 500000,
        total: null,
      }));
    });

    it('should prevent duplicate loads for same URL', async () => {
      let resolveFirst;
      mockLoader.load.mockImplementation((url, onSuccess) => {
        // Don't resolve immediately - keep it pending
        resolveFirst = () => Promise.resolve().then(() => onSuccess({ ...mockTexture }));
      });

      const p1 = loader.load('http://img.com/same.jpg');
      const p2 = loader.load('http://img.com/same.jpg');

      expect(loader.activeLoads.has('http://img.com/same.jpg')).toBe(true);

      resolveFirst();
      await p1;
      await p2;
    });

    it('should remove from activeLoads after success', async () => {
      const url = 'http://img.com/clean-success.jpg';
      mockLoader.load.mockImplementation((_u, onSuccess) => {
        Promise.resolve().then(() => onSuccess({ ...mockTexture }));
      });
      await loader.load(url);
      expect(loader.activeLoads.has(url)).toBe(false);
    });

    it('should remove from activeLoads after error', async () => {
      const url = 'http://img.com/clean-fail.jpg';
      mockLoader.load.mockImplementation((_u, _s, _p, onError) => {
        Promise.resolve().then(() => onError(new Error('fail')));
      });
      await expect(loader.load(url)).rejects.toThrow();
      expect(loader.activeLoads.has(url)).toBe(false);
    });
  });

  describe('loadWithRetry()', () => {
    it('should succeed on first attempt', async () => {
      mockLoader.load.mockImplementation((_u, onSuccess) => {
        Promise.resolve().then(() => onSuccess({ ...mockTexture }));
      });
      const texture = await loader.loadWithRetry('http://img.com/retry-ok.jpg');
      expect(texture).toBeDefined();
    });

    it('should call load multiple times on retry', async () => {
      let callCount = 0;
      mockLoader.load.mockImplementation((_u, onSuccess, _p, onError) => {
        callCount++;
        if (callCount === 1) {
          Promise.resolve().then(() => onError(new Error('First fail')));
        } else {
          Promise.resolve().then(() => onSuccess({ ...mockTexture }));
        }
      });

      const texture = await loader.loadWithRetry('http://img.com/retry2.jpg', { maxRetries: 2 });
      expect(texture).toBeDefined();
      expect(callCount).toBe(2);
    }, 15000);

    it('should throw after all retries exhausted', async () => {
      mockLoader.load.mockImplementation((_u, _s, _p, onError) => {
        Promise.resolve().then(() => onError(new Error('Permanent failure')));
      });

      await expect(
        loader.loadWithRetry('http://img.com/fail-retry.jpg', { maxRetries: 1 })
      ).rejects.toThrow('1 tentatives');
    }, 15000);
  });

  describe('preloadTextures()', () => {
    it('should preload multiple textures', async () => {
      const textures = await loader.preloadTextures([
        'http://img.com/1.jpg',
        'http://img.com/2.jpg',
      ]);
      expect(textures).toHaveLength(2);
      expect(textures[0]).toBeDefined();
      expect(textures[1]).toBeDefined();
    });

    it('should return null for failed preloads without rejecting', async () => {
      let callCount = 0;
      mockLoader.load.mockImplementation((url, onSuccess, _p, onError) => {
        callCount++;
        if (callCount === 2) {
          Promise.resolve().then(() => onError(new Error('fail')));
        } else {
          Promise.resolve().then(() => onSuccess({ ...mockTexture }));
        }
      });

      const textures = await loader.preloadTextures([
        'http://img.com/1.jpg',
        'http://img.com/2.jpg',
      ]);
      expect(textures[0]).not.toBeNull();
      expect(textures[1]).toBeNull();
    });
  });

  describe('cancelAll()', () => {
    it('should clear all active loads', () => {
      loader.activeLoads.set('url1', Promise.resolve());
      loader.activeLoads.set('url2', Promise.resolve());
      loader.cancelAll();
      expect(loader.activeLoads.size).toBe(0);
    });
  });

  describe('dispose()', () => {
    it('should call texture.dispose()', () => {
      const texture = { dispose: jest.fn() };
      loader.dispose(texture);
      expect(texture.dispose).toHaveBeenCalled();
    });

    it('should handle null texture gracefully', () => {
      expect(() => loader.dispose(null)).not.toThrow();
    });

    it('should handle texture without dispose method', () => {
      expect(() => loader.dispose({})).not.toThrow();
    });
  });

  describe('getTextureLoader() singleton', () => {
    it('should return a TextureLoader instance', () => {
      const instance = getTextureLoader();
      expect(instance).toBeInstanceOf(TextureLoader);
    });
  });
});
