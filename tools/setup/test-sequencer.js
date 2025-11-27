const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    const testOrder = [
      'auth.integration.test.ts'
    ];

    return tests.sort((testA, testB) => {
      const orderA = testOrder.findIndex(name => testA.path.includes(name));
      const orderB = testOrder.findIndex(name => testB.path.includes(name));

      if (orderA === -1 && orderB === -1) {
        return testA.path.localeCompare(testB.path);
      }
      if (orderA === -1) return 1;
      if (orderB === -1) return -1;
      
      return orderA - orderB;
    });
  }
}

module.exports = CustomSequencer;