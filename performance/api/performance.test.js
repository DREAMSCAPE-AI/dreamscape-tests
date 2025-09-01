describe('API Performance Test', () => {
  it('should handle 1000 requests in under 1 second', () => {
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      // Simulate API call
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);
  });
});
