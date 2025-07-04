// Test script to verify status calculation logic
function calculateStatus(requiredAmount, currentAmount) {
  const tolerance = 0.01;
  const remaining = Math.max(0, requiredAmount - currentAmount);
  
  if (remaining <= tolerance) {
    return 'PAID';
  } else if (currentAmount > tolerance) {
    return 'PARTIAL';
  } else {
    return 'PENDING';
  }
}

// Test cases
const testCases = [
  { required: 1000, current: 1000, expected: 'PAID' },
  { required: 1000, current: 999.99, expected: 'PAID' }, // Should be PAID due to tolerance
  { required: 1000, current: 500, expected: 'PARTIAL' },
  { required: 1000, current: 0, expected: 'PENDING' },
  { required: 1000, current: 0.005, expected: 'PENDING' }, // Less than tolerance
  { required: 1000, current: 999.995, expected: 'PAID' }, // Should round to PAID
];

console.log('Testing status calculation logic:');
testCases.forEach((test, index) => {
  const result = calculateStatus(test.required, test.current);
  const passed = result === test.expected;
  console.log(`Test ${index + 1}: Required: ₹${test.required}, Current: ₹${test.current} -> ${result} ${passed ? '✓' : '✗ (expected ' + test.expected + ')'}`);
});

console.log('\nAll tests completed.');
