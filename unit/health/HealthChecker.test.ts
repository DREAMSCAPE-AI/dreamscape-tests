import { HealthChecker, HealthStatus, ComponentType, HealthCheckerConfig } from '../../../dreamscape-services/shared/health';

describe('HealthChecker - Unit Tests (INFRA-013.1)', () => {
  describe('Constructor and Configuration', () => {
    it('should create a HealthChecker instance with valid config', () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [],
        includeMetadata: true,
      };

      const checker = new HealthChecker(config);
      expect(checker).toBeInstanceOf(HealthChecker);
    });
  });

  describe('performHealthCheck', () => {
    it('should return HEALTHY status when all checks pass', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Test Check 1',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.HEALTHY,
              message: 'Check passed',
            }),
          },
          {
            name: 'Test Check 2',
            type: ComponentType.CACHE,
            critical: false,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.HEALTHY,
              message: 'Check passed',
            }),
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.service).toBe('test-service');
      expect(result.version).toBe('1.0.0');
      expect(result.checks).toHaveLength(2);
      expect(result.checks[0].status).toBe(HealthStatus.HEALTHY);
      expect(result.checks[1].status).toBe(HealthStatus.HEALTHY);
    });

    it('should return UNHEALTHY status when a critical check fails', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Critical Check',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.UNHEALTHY,
              message: 'Database connection failed',
            }),
          },
          {
            name: 'Optional Check',
            type: ComponentType.CACHE,
            critical: false,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.HEALTHY,
              message: 'Check passed',
            }),
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks[0].status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks[0].message).toBe('Database connection failed');
    });

    it('should return DEGRADED status when a non-critical check fails', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Critical Check',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.HEALTHY,
              message: 'Database OK',
            }),
          },
          {
            name: 'Optional Check',
            type: ComponentType.CACHE,
            critical: false,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.UNHEALTHY,
              message: 'Redis down',
            }),
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.checks[0].status).toBe(HealthStatus.HEALTHY);
      expect(result.checks[1].status).toBe(HealthStatus.DEGRADED);
    });

    it('should handle check timeouts correctly', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Slow Check',
            type: ComponentType.EXTERNAL_API,
            critical: false,
            timeout: 100, // 100ms timeout
            check: async () => {
              // Simulate a slow check that takes 500ms
              await new Promise(resolve => setTimeout(resolve, 500));
              return {
                status: HealthStatus.HEALTHY,
                message: 'Should not reach here',
              };
            },
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(1000);

      expect(result.checks[0].status).toBe(HealthStatus.DEGRADED);
      expect(result.checks[0].message).toContain('timeout');
      expect(result.checks[0].responseTime).toBeLessThan(150); // Should timeout at ~100ms
    });

    it('should handle check exceptions correctly', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Failing Check',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => {
              throw new Error('Unexpected error');
            },
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.checks[0].status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks[0].message).toContain('Unexpected error');
    });

    it('should include metadata when includeMetadata is true', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [],
        includeMetadata: true,
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.environment).toBeDefined();
      expect(result.metadata?.hostname).toBeDefined();
      expect(result.metadata?.pid).toBeDefined();
      expect(result.metadata?.memory).toBeDefined();
      expect(result.metadata?.memory.used).toBeGreaterThan(0);
      expect(result.metadata?.memory.total).toBeGreaterThan(0);
      expect(result.metadata?.memory.percentage).toBeGreaterThanOrEqual(0);
    });

    it('should not include metadata when includeMetadata is false', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [],
        includeMetadata: false,
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.metadata).toBeUndefined();
    });

    it('should execute checks in parallel', async () => {
      const checkStartTimes: number[] = [];

      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Check 1',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => {
              checkStartTimes.push(Date.now());
              await new Promise(resolve => setTimeout(resolve, 100));
              return { status: HealthStatus.HEALTHY, message: 'OK' };
            },
          },
          {
            name: 'Check 2',
            type: ComponentType.CACHE,
            critical: true,
            timeout: 1000,
            check: async () => {
              checkStartTimes.push(Date.now());
              await new Promise(resolve => setTimeout(resolve, 100));
              return { status: HealthStatus.HEALTHY, message: 'OK' };
            },
          },
        ],
      };

      const startTime = Date.now();
      const checker = new HealthChecker(config);
      await checker.performHealthCheck(5000);
      const totalTime = Date.now() - startTime;

      // If checks run in parallel, total time should be ~100ms (not 200ms)
      expect(totalTime).toBeLessThan(150); // Allow some margin

      // Check start times should be very close (parallel execution)
      expect(Math.abs(checkStartTimes[0] - checkStartTimes[1])).toBeLessThan(20);
    });

    it('should return UNKNOWN status when all checks are unknown', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Unknown Check',
            type: ComponentType.DATABASE,
            critical: false,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.UNKNOWN,
              message: 'Status unknown',
            }),
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.status).toBe(HealthStatus.UNKNOWN);
    });

    it('should measure response time for each check', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Timed Check',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => {
              await new Promise(resolve => setTimeout(resolve, 50));
              return { status: HealthStatus.HEALTHY, message: 'OK' };
            },
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.checks[0].responseTime).toBeDefined();
      expect(result.checks[0].responseTime).toBeGreaterThanOrEqual(50);
      expect(result.checks[0].responseTime).toBeLessThan(100);
    });

    it('should include timestamp for overall response and each check', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Test Check',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.HEALTHY,
              message: 'OK',
            }),
          },
        ],
      };

      const beforeTime = new Date();
      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);
      const afterTime = new Date();

      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());

      expect(result.checks[0].timestamp).toBeInstanceOf(Date);
      expect(result.checks[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(result.checks[0].timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should calculate uptime correctly', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [],
      };

      const checker = new HealthChecker(config);

      // Wait a bit to ensure uptime > 0
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await checker.performHealthCheck(5000);

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('getHttpStatus', () => {
    it('should return 200 for HEALTHY status', () => {
      expect(HealthChecker.getHttpStatus(HealthStatus.HEALTHY)).toBe(200);
    });

    it('should return 206 for DEGRADED status', () => {
      expect(HealthChecker.getHttpStatus(HealthStatus.DEGRADED)).toBe(206);
    });

    it('should return 503 for UNHEALTHY status', () => {
      expect(HealthChecker.getHttpStatus(HealthStatus.UNHEALTHY)).toBe(503);
    });

    it('should return 500 for UNKNOWN status', () => {
      expect(HealthChecker.getHttpStatus(HealthStatus.UNKNOWN)).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty checks array', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.checks).toHaveLength(0);
    });

    it('should handle check with no timeout specified', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'No Timeout Check',
            type: ComponentType.DATABASE,
            critical: true,
            // No timeout specified
            check: async () => ({
              status: HealthStatus.HEALTHY,
              message: 'OK',
            }),
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.checks[0].status).toBe(HealthStatus.HEALTHY);
    });

    it('should handle check returning partial details', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Minimal Check',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.HEALTHY,
              message: 'OK',
              details: {
                customField: 'customValue',
              },
            }),
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.checks[0].details).toEqual({ customField: 'customValue' });
    });

    it('should handle multiple critical failures', async () => {
      const config: HealthCheckerConfig = {
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
        checks: [
          {
            name: 'Critical Check 1',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.UNHEALTHY,
              message: 'DB1 down',
            }),
          },
          {
            name: 'Critical Check 2',
            type: ComponentType.DATABASE,
            critical: true,
            timeout: 1000,
            check: async () => ({
              status: HealthStatus.UNHEALTHY,
              message: 'DB2 down',
            }),
          },
        ],
      };

      const checker = new HealthChecker(config);
      const result = await checker.performHealthCheck(5000);

      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks[0].status).toBe(HealthStatus.UNHEALTHY);
      expect(result.checks[1].status).toBe(HealthStatus.UNHEALTHY);
    });
  });
});
