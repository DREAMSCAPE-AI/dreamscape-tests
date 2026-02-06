/**
 * Debug script to test imports
 */

async function testImports() {
  console.log('Testing @dreamscape/db import...');
  try {
    const db = await import('@dreamscape/db');
    console.log('✓ @dreamscape/db imported successfully');
    console.log('  Exports:', Object.keys(db));
  } catch (error) {
    console.error('✗ @dreamscape/db import failed:');
    console.error('  Error:', error.message);
    console.error('  Stack:', error.stack);
  }

  console.log('\nTesting @ai/services/ScoringService import...');
  try {
    const scoring = await import('../dreamscape-services/ai/src/services/ScoringService');
    console.log('✓ ScoringService imported successfully');
    console.log('  Exports:', Object.keys(scoring));
  } catch (error) {
    console.error('✗ ScoringService import failed:');
    console.error('  Error:', error.message);
    console.error('  Stack:', error.stack);
  }

  console.log('\nTesting @ai/services/VectorizationService import...');
  try {
    const vec = await import('../dreamscape-services/ai/src/services/VectorizationService');
    console.log('✓ VectorizationService imported successfully');
    console.log('  Exports:', Object.keys(vec));
  } catch (error) {
    console.error('✗ VectorizationService import failed:');
    console.error('  Error:', error.message);
    console.error('  Stack:', error.stack);
  }
}

testImports().catch(console.error);
