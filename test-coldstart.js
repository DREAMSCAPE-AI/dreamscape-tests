const path = require('path');

async function testImport() {
  try {
    console.log('Testing ColdStartService import...');
    const module = await import('../dreamscape-services/ai/src/cold-start/cold-start.service.ts');
    console.log('✓ ColdStartService imported successfully');
    console.log('  Exports:', Object.keys(module));
  } catch (error) {
    console.error('✗ ColdStartService import failed:');
    console.error('  Error:', error.message);
    console.error('  Stack:', error.stack);
  }
}

testImport();
