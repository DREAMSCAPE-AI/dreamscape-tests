/**
 * Debug test for ColdStartService import
 */

describe('ColdStartService Import Debug', () => {
  it('should import ColdStartService', async () => {
    try {
      const module = await import('@ai/recommendations/cold-start.service');
      console.log('✓ Module imported successfully');
      console.log('  Exports:', Object.keys(module));
      expect(module.ColdStartService).toBeDefined();
    } catch (error: any) {
      console.error('✗ Import failed:');
      console.error('  Error:', error.message);
      console.error('  Stack:', error.stack);
      throw error;
    }
  });
});
