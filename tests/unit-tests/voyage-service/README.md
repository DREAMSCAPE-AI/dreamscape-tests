# Voyage Service Unit Tests

## Overview

This directory contains unit tests for the Voyage microservice, which handles travel booking and Amadeus API integration.

## Test Files

### CacheService.test.ts
**Ticket:** DR-65US-VOYAGE-004 - Cache des Requêtes Amadeus

Tests for the Redis-based caching system that optimizes Amadeus API calls.

**Test Coverage:**
- ✅ Basic cache operations (get, set, delete)
- ✅ Cache wrapper functionality
- ✅ Statistics tracking (hits, misses, hit rate)
- ✅ Pattern-based cache clearing
- ✅ Connection health checks
- ✅ Error handling
- ✅ Cache key generation

**Prerequisites:**
- Redis server running on `localhost:6379`
- Environment variables configured in voyage service

**Running Tests:**
```bash
# From dreamscape-tests directory
npm run test -- CacheService.test.ts

# With coverage
npm run test:coverage -- voyage-service
```

## Test Environment

### Redis Setup

For local testing:
```bash
# Using Docker
docker run -d --name redis-test -p 6379:6379 redis:7-alpine

# Verify Redis is running
docker ps | grep redis-test
redis-cli ping
```

### Environment Variables

Ensure the voyage service has these variables set:
```env
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
```

## Test Structure

```
voyage-service/
├── CacheService.test.ts       # Cache system tests
└── README.md                  # This file
```

## Expected Test Results

When Redis is running and properly configured:
- All tests should pass ✅
- Cache hit rate tests verify caching works correctly
- Connection health checks confirm Redis connectivity

### Sample Output

```
PASS tests/unit-tests/voyage-service/CacheService.test.ts
  CacheService - DR-65US-VOYAGE-004
    Basic Cache Operations
      ✓ should set and get a value from cache (50ms)
      ✓ should return null for non-existent key (5ms)
      ✓ should delete a key from cache (12ms)
      ✓ should handle complex objects (15ms)
    Cache Wrapper
      ✓ should cache API call results (25ms)
      ✓ should call API for different parameters (30ms)
      ✓ should use correct TTL for different cache types (20ms)
    Cache Statistics
      ✓ should track cache hits and misses (15ms)
      ✓ should calculate hit rate correctly (18ms)
      ✓ should reset statistics (8ms)
    Pattern Clearing
      ✓ should clear multiple keys matching a pattern (35ms)
      ✓ should return 0 when no keys match pattern (10ms)
      ✓ should handle clearing all amadeus keys (28ms)
    Connection Health
      ✓ should check if Redis is connected (5ms)
      ✓ should ping Redis successfully (8ms)
      ✓ should provide connection status in stats (5ms)
    Error Handling
      ✓ should handle gracefully when Redis is not connected (12ms)
      ✓ should not break cache wrapper when API throws error (10ms)
    Cache Key Generation
      ✓ should generate consistent keys for same parameters (25ms)
      ✓ should generate different keys for different parameter order (22ms)

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
Time:        2.5s
```

## Troubleshooting

### Tests Failing

1. **Redis not running:**
   ```bash
   docker start redis-test
   # or
   docker run -d --name redis-test -p 6379:6379 redis:7-alpine
   ```

2. **Connection timeout:**
   - Check Redis is accessible: `redis-cli ping`
   - Verify port 6379 is not blocked
   - Check REDIS_URL environment variable

3. **Import errors:**
   - Ensure voyage service dependencies are installed
   - Run `npm install` in `dreamscape-services/voyage/`

### Cleaning Test Data

If tests leave residual data in Redis:
```bash
redis-cli FLUSHALL
# or selectively
redis-cli KEYS "amadeus:test:*" | xargs redis-cli DEL
```

## CI/CD Integration

These tests are part of the centralized test suite and run automatically on:
- Pull requests to `main`
- Deployment pipelines
- Nightly test runs

**Requirements for CI:**
- Redis service must be available
- Environment variables injected via CI secrets
- Test isolation ensured between runs

## Related Documentation

- **Cache Implementation:** `dreamscape-docs/guides/cache/redis-cache-implementation.md`
- **Ticket Details:** `dreamscape-services/voyage/DR-65US-VOYAGE-004.md`
- **Service Source:** `dreamscape-services/voyage/src/services/CacheService.ts`
- **API Documentation:** `dreamscape-docs/api/voyage-service.md`

## Future Tests

Potential additions:
- [ ] Integration tests with real Amadeus API
- [ ] Performance benchmarks
- [ ] Load testing for high-volume caching
- [ ] Cache eviction policy tests
- [ ] Multi-instance cache consistency tests
- [ ] Failover and recovery tests

## Contributing

When adding new cache features:
1. Write tests first (TDD approach)
2. Ensure >80% code coverage
3. Update this README
4. Link tests to Jira ticket
5. Run full test suite before PR

## Support

For issues with tests:
- Check voyage service logs
- Review Redis logs: `docker logs redis-test`
- Consult cache documentation
- Create Jira ticket with test output
