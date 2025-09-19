// Simple test to verify Jest configuration is working
describe('Basic Test Suite', () => {
  it('should run basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toBe('hello');
    expect(true).toBeTruthy();
    expect(false).toBeFalsy();
  });

  it('should have access to global test utilities', () => {
    expect(global.testUtils).toBeDefined();
    expect(global.testUtils.generateTestToken).toBeInstanceOf(Function);
    expect(global.testUtils.generateTestUser).toBeInstanceOf(Function);
    expect(global.testUtils.wait).toBeInstanceOf(Function);
  });

  it('should generate test data correctly', () => {
    const testUser = global.testUtils.generateTestUser();
    expect(testUser.email).toMatch(/^test\d+@example\.com$/);
    expect(testUser.password).toBe('TestPassword123!');
    expect(testUser.username).toMatch(/^testuser\d+$/);
  });

  it('should generate JWT tokens', () => {
    const token = global.testUtils.generateTestToken();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('should have environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.JWT_SECRET).toBeDefined();
    expect(process.env.JWT_REFRESH_SECRET).toBeDefined();
  });

  it('should handle async operations', async () => {
    const start = Date.now();
    await global.testUtils.wait(100);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(90);
  });
});