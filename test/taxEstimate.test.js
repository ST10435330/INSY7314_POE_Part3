const { test } = require('node:test');
const assert = require('node:assert/strict');
const { estimateTax } = require('../src/services/taxEstimate');

test('estimated tax is rounded to the nearest cent before subtraction', () => {
  const result = estimateTax(1003);
  assert.equal(result.estimatedTax, 2.01);
  assert.equal(result.afterEstimatedTax, 8.02);
});
