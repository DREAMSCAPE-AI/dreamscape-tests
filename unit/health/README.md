# Health Check Tests - INFRA-013.1

Comprehensive automated test suite for the health check system implemented in INFRA-013.1.

## Overview

This test suite validates the health check infrastructure across all DreamScape services, ensuring:
- ✅ Health check endpoints work correctly
- ✅ Dependencies are properly monitored
- ✅ Response formats are standardized
- ✅ Error handling is robust
- ✅ Performance meets requirements

## Test Structure

```
dreamscape-tests/
├── unit/health/                    # Unit tests
│   ├── HealthChecker.test.ts       # Core HealthChecker class tests
│   ├── checks.test.ts              # Helper functions tests
│   └── README.md                   # This file
├── integration/health/             # Integration tests
│   ├── user-health.test.ts         # User service endpoint tests
│   ├── gateway-health.test.ts      # Gateway service endpoint tests
│   └── voyage-health.test.ts       # Voyage service endpoint tests
├── jest.config.health.js           # Jest configuration for health tests
├── jest.setup.health.ts            # Test setup and utilities
└── __mocks__/                      # Mock modules
    └── db.ts                       # Database mock
```

## Running Tests

### All Health Check Tests

```bash
cd dreamscape-tests
npm run test:health
```

### Unit Tests Only

```bash
npm run test:health:unit
```

### Integration Tests Only

```bash
npm run test:health:integration
```

### Specific Test File

```bash
npx jest unit/health/HealthChecker.test.ts
```

### With Coverage

```bash
npm run test:health:coverage
```

### Watch Mode (for development)

```bash
npm run test:health:watch
```

## Test Coverage

Current coverage targets (defined in `jest.config.health.js`):

- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%

View coverage report after running tests:

```bash
npm run test:health:coverage
open coverage/health/lcov-report/index.html
```

## Test Categories

### Unit Tests

#### HealthChecker.test.ts (16 test cases)
Tests the core `HealthChecker` class:
- ✅ Constructor and configuration
- ✅ Health check execution (HEALTHY, DEGRADED, UNHEALTHY, UNKNOWN)
- ✅ Critical vs non-critical check handling
- ✅ Timeout handling
- ✅ Error handling
- ✅ Metadata collection
- ✅ Parallel check execution
- ✅ HTTP status code mapping
- ✅ Edge cases

#### checks.test.ts (20+ test cases)
Tests helper functions for common dependency checks:
- ✅ PostgreSQL connectivity check
- ✅ Redis connectivity check
- ✅ External API check
- ✅ Filesystem check
- ✅ Custom check creation
- ✅ Error scenarios
- ✅ Response time measurement

### Integration Tests

#### user-health.test.ts (25+ test cases)
Tests User Service health endpoints:
- ✅ GET /health - Full health check
- ✅ GET /health/live - Liveness probe
- ✅ GET /health/ready - Readiness probe
- ✅ PostgreSQL dependency checks
- ✅ Filesystem checks (uploads directory)
- ✅ Error handling
- ✅ Response format validation
- ✅ Performance requirements

#### gateway-health.test.ts (25+ test cases)
Tests Gateway Service health endpoints:
- ✅ GET /health - Full health check
- ✅ GET /health/live - Liveness probe
- ✅ GET /health/ready - Readiness probe
- ✅ Downstream service checks (Auth, User, Voyage, AI)
- ✅ Critical vs non-critical service failures
- ✅ Environment variable configuration
- ✅ Error handling
- ✅ Response format validation

#### voyage-health.test.ts (25+ test cases)
Tests Voyage Service health endpoints:
- ✅ GET /health - Full health check
- ✅ GET /health/live - Liveness probe
- ✅ GET /health/ready - Readiness probe
- ✅ PostgreSQL dependency checks
- ✅ Optional MongoDB checks
- ✅ Error handling
- ✅ Response format validation

## Test Patterns

### Mocking Database Connections

```typescript
const mockPrisma = {
  $queryRaw: jest.fn(),
};

jest.mock('@dreamscape/db', () => ({
  prisma: mockPrisma,
}));

// Success scenario
mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

// Failure scenario
mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
```

### Testing HTTP Endpoints

```typescript
import request from 'supertest';
import express from 'express';
import healthRoutes from '../../../dreamscape-services/user/src/routes/health';

const app = express();
app.use('/health', healthRoutes);

const response = await request(app)
  .get('/health')
  .expect(200);

expect(response.body.status).toBe('healthy');
```

### Testing HealthChecker

```typescript
import { HealthChecker, HealthStatus, ComponentType } from '../../../dreamscape-services/shared/health';

const checker = new HealthChecker({
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
});

const result = await checker.performHealthCheck(5000);
expect(result.status).toBe(HealthStatus.HEALTHY);
```

## Performance Requirements

Health check tests validate these performance requirements:

| Endpoint | Max Response Time | Test Validation |
|----------|------------------|-----------------|
| `/health` | 2 seconds | Full health check |
| `/health/live` | 100 ms | Liveness probe |
| `/health/ready` | 500 ms | Readiness probe |

## Continuous Integration

Tests are automatically run in CI/CD pipeline:

```yaml
# .github/workflows/health-tests.yml
- name: Run Health Check Tests
  run: npm run test:health:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/health/lcov.info
```

## Troubleshooting

### Tests Timing Out

If tests are timing out, increase the timeout in `jest.config.health.js`:

```javascript
testTimeout: 20000, // 20 seconds
```

Or for specific tests:

```typescript
it('slow test', async () => {
  // test code
}, 20000); // 20 second timeout
```

### Mock Not Working

Ensure mocks are defined before imports:

```typescript
// ❌ Wrong order
import { prisma } from '@dreamscape/db';
jest.mock('@dreamscape/db');

// ✅ Correct order
jest.mock('@dreamscape/db');
import { prisma } from '@dreamscape/db';
```

### Database Connection Errors

If you see actual database connection attempts in tests, ensure mocks are properly configured in `jest.config.health.js`:

```javascript
moduleNameMapper: {
  '^@dreamscape/db$': '<rootDir>/__mocks__/db.ts',
}
```

## Contributing

When adding new health check features:

1. **Write tests first** (TDD approach)
2. **Update existing tests** if behavior changes
3. **Maintain coverage** above 80%
4. **Follow naming conventions**:
   - Unit tests: `<ComponentName>.test.ts`
   - Integration tests: `<service>-health.test.ts`
5. **Document test scenarios** in comments

## Related Documentation

- [INFRA-013 Implementation Guide](../../docs/INFRA-013-IMPLEMENTATION-COMPLETE.md)
- [Health Check Architecture](../../docs/health-checks-architecture.md)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)

## Test Results

After running tests, results are saved in:

- **JUnit XML**: `./reports/health/junit.xml` (for CI/CD)
- **Coverage Report**: `./coverage/health/lcov-report/index.html`
- **Console Output**: Immediate feedback

## Questions?

For questions about health check tests, contact the infrastructure team or refer to:
- Jira Ticket: DR-311
- Documentation: `docs/INFRA-013-IMPLEMENTATION-COMPLETE.md`
- Slack Channel: #dreamscape-infra
