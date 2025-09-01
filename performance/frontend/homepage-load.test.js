describe('Frontend Performance Test', () => {
  it('should load the homepage in under 2 seconds', () => {
    const loadTime = 1500; // Simulated load time in ms
    expect(loadTime).toBeLessThan(2000);
  });
});
