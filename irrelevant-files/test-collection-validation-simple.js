/**
 * Test the collection day validation logic in JavaScript
 */

function validateCollectionSchedule(data) {
  const frequency = data.collectionFrequency || 'MONTHLY';
  
  // Apply defaults and validate based on frequency
  switch (frequency) {
    case 'MONTHLY':
    case 'YEARLY':
      if (!data.collectionDayOfMonth) {
        // Auto-set default if not provided
        data.collectionDayOfMonth = 1;
      }
      if (data.collectionDayOfMonth < 1 || data.collectionDayOfMonth > 31) {
        throw new Error('Collection day of month must be between 1 and 31');
      }
      break;
      
    case 'WEEKLY':
      if (!data.collectionDayOfWeek) {
        // Auto-set default if not provided
        data.collectionDayOfWeek = 'MONDAY';
      }
      break;
      
    case 'FORTNIGHTLY':
      if (!data.collectionDayOfWeek) {
        data.collectionDayOfWeek = 'MONDAY';
      }
      if (!data.collectionWeekOfMonth) {
        data.collectionWeekOfMonth = 1;
      }
      if (data.collectionWeekOfMonth < 1 || data.collectionWeekOfMonth > 4) {
        throw new Error('Collection week of month must be between 1 and 4');
      }
      break;
  }
  
  return data;
}

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
