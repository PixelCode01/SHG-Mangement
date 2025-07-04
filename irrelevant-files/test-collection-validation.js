/**
 * Test the collection day validation to ensure it prevents null values
 */

const { validateCollectionSchedule } = require('./app/lib/collection-schedule-validator');

console.log('🧪 Testing Collection Day Validation...\n');

// Test 1: Monthly frequency without collection day (should get default)
console.log('Test 1: Monthly frequency without collection day');
try {
  const result1 = validateCollectionSchedule({
    collectionFrequency: 'MONTHLY'
  });
  console.log('✅ Result:', result1);
  console.log('   Collection Day of Month:', result1.collectionDayOfMonth);
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('');

// Test 2: Weekly frequency without collection day (should get default)
console.log('Test 2: Weekly frequency without collection day');
try {
  const result2 = validateCollectionSchedule({
    collectionFrequency: 'WEEKLY'
  });
  console.log('✅ Result:', result2);
  console.log('   Collection Day of Week:', result2.collectionDayOfWeek);
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('');

// Test 3: Monthly with invalid day (should fail)
console.log('Test 3: Monthly with invalid collection day (32)');
try {
  const result3 = validateCollectionSchedule({
    collectionFrequency: 'MONTHLY',
    collectionDayOfMonth: 32
  });
  console.log('✅ Result:', result3);
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('');

// Test 4: Monthly with valid day (should pass)
console.log('Test 4: Monthly with valid collection day (15)');
try {
  const result4 = validateCollectionSchedule({
    collectionFrequency: 'MONTHLY',
    collectionDayOfMonth: 15
  });
  console.log('✅ Result:', result4);
  console.log('   Collection Day of Month:', result4.collectionDayOfMonth);
} catch (error) {
  console.log('❌ Error:', error.message);
}

console.log('\n🎉 Validation tests completed!');
