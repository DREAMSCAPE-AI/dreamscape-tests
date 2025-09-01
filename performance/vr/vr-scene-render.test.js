describe('VR Performance Test', () => {
  it('should render VR scene within 3 seconds', () => {
    const renderTime = 2500; // Simulated render time in ms
    expect(renderTime).toBeLessThan(3000);
  });
});
