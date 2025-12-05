import {
  createPostgreSQLCheck,
  createRedisCheck,
  createExternalAPICheck,
  createFileSystemCheck,
  createCustomCheck,
  HealthStatus,
} from '../../../dreamscape-services/shared/health';

describe('Health Check Helpers - Unit Tests (INFRA-013.1)', () => {
  describe('createPostgreSQLCheck', () => {
    it('should return HEALTHY when PostgreSQL query succeeds', async () => {
      const mockPool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ health_check: 1 }],
        }),
      };

      const check = createPostgreSQLCheck(mockPool as any, 'TestDB');
      const result = await check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toContain('successful');
      expect(result.details?.connected).toBe(true);
      expect(result.details?.responseTime).toBeGreaterThanOrEqual(0);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1 AS health_check');
    });

    it('should return DEGRADED when PostgreSQL returns unexpected result', async () => {
      const mockPool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ health_check: 2 }], // Unexpected value
        }),
      };

      const check = createPostgreSQLCheck(mockPool as any, 'TestDB');
      const result = await check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.message).toContain('unexpected result');
    });

    it('should return UNHEALTHY when PostgreSQL connection fails', async () => {
      const mockPool = {
        query: jest.fn().mockRejectedValue(new Error('Connection refused')),
      };

      const check = createPostgreSQLCheck(mockPool as any, 'TestDB');
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('failed');
      expect(result.message).toContain('Connection refused');
      expect(result.details?.connected).toBe(false);
      expect(result.details?.error).toBe('Connection refused');
    });
  });

  describe('createRedisCheck', () => {
    it('should return HEALTHY when Redis PING succeeds', async () => {
      const mockClient = {
        isReady: true,
        ping: jest.fn().mockResolvedValue('PONG'),
      };

      const check = createRedisCheck(mockClient as any, 'TestRedis');
      const result = await check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toContain('successful');
      expect(result.details?.connected).toBe(true);
      expect(result.details?.responseTime).toBeGreaterThanOrEqual(0);
      expect(mockClient.ping).toHaveBeenCalled();
    });

    it('should return UNHEALTHY when Redis client is not ready', async () => {
      const mockClient = {
        isReady: false,
        ping: jest.fn(),
      };

      const check = createRedisCheck(mockClient as any, 'TestRedis');
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('not ready');
      expect(result.details?.connected).toBe(false);
      expect(mockClient.ping).not.toHaveBeenCalled();
    });

    it('should return DEGRADED when Redis ping returns unexpected result', async () => {
      const mockClient = {
        isReady: true,
        ping: jest.fn().mockResolvedValue('UNEXPECTED'),
      };

      const check = createRedisCheck(mockClient as any, 'TestRedis');
      const result = await check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.message).toContain('unexpected result');
      expect(result.details?.response).toBe('UNEXPECTED');
    });

    it('should return UNHEALTHY when Redis connection fails', async () => {
      const mockClient = {
        isReady: true,
        ping: jest.fn().mockRejectedValue(new Error('Connection lost')),
      };

      const check = createRedisCheck(mockClient as any, 'TestRedis');
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('failed');
      expect(result.message).toContain('Connection lost');
      expect(result.details?.connected).toBe(false);
      expect(result.details?.error).toBe('Connection lost');
    });
  });

  describe('createExternalAPICheck', () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return HEALTHY when API returns 200', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const check = createExternalAPICheck('http://test.com/health', 'TestAPI', {
        timeout: 5000,
      });
      const result = await check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toContain('accessible');
      expect(result.details?.url).toBe('http://test.com/health');
      expect(result.details?.statusCode).toBe(200);
      expect(result.details?.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return DEGRADED when API returns non-OK status', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
      });

      const check = createExternalAPICheck('http://test.com/health', 'TestAPI', {
        timeout: 5000,
      });
      const result = await check();

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.message).toContain('non-OK status');
      expect(result.details?.statusCode).toBe(500);
    });

    it('should return UNHEALTHY when API request fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const check = createExternalAPICheck('http://test.com/health', 'TestAPI', {
        timeout: 5000,
      });
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('failed');
      expect(result.message).toContain('Network error');
      expect(result.details?.error).toBe('Network error');
    });

    it('should handle timeout correctly', async () => {
      // Mock fetch to take longer than timeout
      (global.fetch as jest.Mock).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ ok: true, status: 200 }), 200))
      );

      const check = createExternalAPICheck('http://test.com/health', 'TestAPI', {
        timeout: 50, // Very short timeout
      });
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('failed');
    }, 10000);

    it('should support custom HTTP method', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const check = createExternalAPICheck('http://test.com/health', 'TestAPI', {
        method: 'POST',
        timeout: 5000,
      });
      await check();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test.com/health',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should support custom headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
      });

      const check = createExternalAPICheck('http://test.com/health', 'TestAPI', {
        headers: { 'X-Custom-Header': 'test' },
        timeout: 5000,
      });
      await check();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test.com/health',
        expect.objectContaining({
          headers: { 'X-Custom-Header': 'test' },
        })
      );
    });
  });

  describe('createFileSystemCheck', () => {
    it('should return HEALTHY when filesystem path is accessible', async () => {
      // Mock fs/promises
      const mockAccess = jest.fn().mockResolvedValue(undefined);
      jest.doMock('fs/promises', () => ({
        access: mockAccess,
      }));

      const check = createFileSystemCheck('/test/path', 'TestFS');
      const result = await check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toContain('accessible');
      expect(result.details?.path).toBe('/test/path');
      expect(result.details?.accessible).toBe(true);
      expect(result.details?.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return UNHEALTHY when filesystem path is not accessible', async () => {
      const check = createFileSystemCheck('/nonexistent/path', 'TestFS');
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('failed');
      expect(result.details?.path).toBe('/nonexistent/path');
      expect(result.details?.accessible).toBe(false);
      expect(result.details?.error).toBeDefined();
    });
  });

  describe('createCustomCheck', () => {
    it('should return HEALTHY when custom check returns true', async () => {
      const customFn = jest.fn().mockResolvedValue(true);
      const check = createCustomCheck('Custom Check', customFn, 'Success', 'Failed');
      const result = await check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Success');
      expect(result.details?.responseTime).toBeGreaterThanOrEqual(0);
      expect(customFn).toHaveBeenCalled();
    });

    it('should return UNHEALTHY when custom check returns false', async () => {
      const customFn = jest.fn().mockResolvedValue(false);
      const check = createCustomCheck('Custom Check', customFn, 'Success', 'Failed');
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toBe('Failed');
      expect(customFn).toHaveBeenCalled();
    });

    it('should return UNHEALTHY when custom check throws error', async () => {
      const customFn = jest.fn().mockRejectedValue(new Error('Custom error'));
      const check = createCustomCheck('Custom Check', customFn, 'Success', 'Failed');
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('error');
      expect(result.message).toContain('Custom error');
      expect(result.details?.error).toBe('Custom error');
    });

    it('should use default messages when not provided', async () => {
      const customFn = jest.fn().mockResolvedValue(true);
      const check = createCustomCheck('Custom Check', customFn);
      const result = await check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.message).toBe('Check passed');
    });

    it('should measure response time correctly', async () => {
      const customFn = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return true;
      });

      const check = createCustomCheck('Custom Check', customFn);
      const result = await check();

      expect(result.details?.responseTime).toBeGreaterThanOrEqual(50);
      expect(result.details?.responseTime).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined errors gracefully', async () => {
      const mockPool = {
        query: jest.fn().mockRejectedValue(null),
      };

      const check = createPostgreSQLCheck(mockPool as any, 'TestDB');
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.message).toContain('Unknown error');
    });

    it('should handle empty name parameter', async () => {
      const mockPool = {
        query: jest.fn().mockResolvedValue({
          rows: [{ health_check: 1 }],
        }),
      };

      const check = createPostgreSQLCheck(mockPool as any, '');
      const result = await check();

      expect(result.status).toBe(HealthStatus.HEALTHY);
    });

    it('should handle special characters in messages', async () => {
      const mockPool = {
        query: jest.fn().mockRejectedValue(new Error('Error: <script>alert("xss")</script>')),
      };

      const check = createPostgreSQLCheck(mockPool as any, 'TestDB');
      const result = await check();

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.details?.error).toContain('<script>');
    });
  });
});
