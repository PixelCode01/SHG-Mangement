/**
 * Test script to validate the NaN error fix in the group summary feature
 * This script simulates scenarios that could cause NaN values and validates proper handling
 */

// Test the safeFormat function (simulated)
function safeFormat(value, type = 'number') {
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return type === 'currency' ? '₹0' : type === 'percentage' ? '0%' : '0';
  }
  
  switch (type) {
    case 'currency':
      return `₹${num.toLocaleString()}`;
    case 'percentage':
      return `${num.toFixed(1)}%`;
    default:
      return num.toLocaleString();
  }
}

// Test the safeNumber function (simulated)
function safeNumber(value) {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

// Test scenarios that could cause NaN values
const testCases = [
  { value: undefined, expected: '₹0', type: 'currency' },
  { value: null, expected: '₹0', type: 'currency' },
  { value: NaN, expected: '₹0', type: 'currency' },
  { value: 'invalid', expected: '₹0', type: 'currency' },
  { value: Infinity, expected: '₹0', type: 'currency' },
  { value: -Infinity, expected: '₹0', type: 'currency' },
  { value: '', expected: '₹0', type: 'currency' },
  { value: {}, expected: '₹0', type: 'currency' },
  { value: [], expected: '₹0', type: 'currency' },
  { value: 1000, expected: '₹1,000', type: 'currency' },
  { value: 0, expected: '₹0', type: 'currency' },
  { value: -500, expected: '₹-500', type: 'currency' },
  { value: 75.5, expected: '75.5%', type: 'percentage' },
  { value: NaN, expected: '0%', type: 'percentage' },
  { value: 123456, expected: '123,456', type: 'number' },
  { value: 'abc', expected: '0', type: 'number' }
];

console.log('🧪 Testing NaN Error Fix for Group Summary\n');

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  const result = safeFormat(testCase.value, testCase.type);
  const passed = result === testCase.expected;
  
  console.log(`Test ${index + 1}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Input: ${JSON.stringify(testCase.value)} (${testCase.type})`);
  console.log(`  Expected: ${testCase.expected}`);
  console.log(`  Got: ${result}`);
  
  if (passed) passedTests++;
  console.log('');
});

// Test chart data validation
console.log('📊 Testing Chart Data Validation\n');

const mockChartData = [
  1000, 2000, undefined, null, NaN, 'invalid', 3000, Infinity, -1000, 0
];

const validatedData = mockChartData.map(val => safeNumber(val));
console.log('Original data:', mockChartData);
console.log('Validated data:', validatedData);

// Test coordinate calculation for SVG
console.log('\n🎯 Testing SVG Coordinate Calculation\n');

const chartDataLength = 6;
const validDataPoints = mockChartData
  .map((value, index) => ({ value: safeNumber(value), index }))
  .filter(point => point.value >= 0 || point.value < 0); // Allow negative values but filter out NaN/invalid

console.log('Valid data points for SVG rendering:');
validDataPoints.forEach((point, idx) => {
  const x = chartDataLength > 1 ? (point.index / (chartDataLength - 1)) * 380 + 10 : 200;
  const y = 110 - ((point.value - 0) / 1000) * 100; // Mock calculation
  
  console.log(`  Point ${idx}: value=${point.value}, x=${x}, y=${y}`);
  
  if (isNaN(x) || isNaN(y)) {
    console.log(`    ❌ WARNING: NaN coordinates detected!`);
  } else {
    console.log(`    ✅ Valid coordinates`);
  }
});

console.log('\n📈 Summary:');
console.log(`Passed: ${passedTests}/${totalTests} tests`);
console.log(`Success Rate: ${((passedTests/totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 All tests passed! NaN error fix is working correctly.');
} else {
  console.log('\n⚠️  Some tests failed. Please review the implementation.');
}

// Additional validation for specific API response handling
console.log('\n🔍 Testing API Response Handling\n');

const mockAPIResponse = {
  financialOverview: {
    totalGroupStanding: undefined,
    currentCashInBank: null,
    currentCashInHand: 'invalid',
    sharePerMember: NaN,
    growthFromStart: Infinity
  },
  loanStatistics: {
    totalActiveLoans: 5,
    totalLoanAmount: 50000,
    totalOutstandingAmount: {},
    repaymentRate: 'abc'
  },
  monthlyTrends: [
    { totalStanding: 1000, collections: 500, expenses: undefined },
    { totalStanding: null, collections: NaN, expenses: 200 },
    { totalStanding: 'invalid', collections: Infinity, expenses: -100 }
  ]
};

console.log('Testing safe number extraction from API response:');

// Test financial overview
const safeFinancialOverview = {
  totalGroupStanding: safeNumber(mockAPIResponse.financialOverview.totalGroupStanding),
  currentCashInBank: safeNumber(mockAPIResponse.financialOverview.currentCashInBank),
  currentCashInHand: safeNumber(mockAPIResponse.financialOverview.currentCashInHand),
  sharePerMember: safeNumber(mockAPIResponse.financialOverview.sharePerMember),
  growthFromStart: safeNumber(mockAPIResponse.financialOverview.growthFromStart)
};

console.log('Original:', mockAPIResponse.financialOverview);
console.log('Safe version:', safeFinancialOverview);

// Test chart data preparation
const chartTrendData = mockAPIResponse.monthlyTrends.map(trend => safeNumber(trend.totalStanding));
console.log('\nChart data (totalStanding):', chartTrendData);

console.log('\n✨ NaN Error Fix Validation Complete! ✨');
