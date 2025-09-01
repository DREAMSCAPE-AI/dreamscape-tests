describe('Penetration Test', () => {
  it('should not expose sensitive data in headers', () => {
    const headers = {
      'x-powered-by': 'Express',
      'server': 'Apache'
    };
    expect(headers['x-powered-by']).toBeUndefined();
    expect(headers['server']).toBeUndefined();
  });
});
