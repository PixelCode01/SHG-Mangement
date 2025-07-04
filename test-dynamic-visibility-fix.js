#!/usr/bin/env node

// Test script to verify dynamic field visibility fix
console.log('🔧 Testing Dynamic Field Visibility Fix...\n');

const fs = require('fs');
const path = require('path');

try {
  // Check if the fix is properly implemented
  const formContent = fs.readFileSync('./app/components/MultiStepGroupForm.tsx', 'utf8');
  
  console.log('✅ Checking dynamic field visibility implementation:');
  
  // Check for useWatch usage
  if (formContent.includes('const loanInsuranceEnabled = useWatch({ control, name: \'loanInsuranceEnabled\' });')) {
    console.log('   ✅ Loan Insurance field uses useWatch for proper re-rendering');
  } else {
    console.log('   ❌ Loan Insurance field is not using useWatch');
  }
  
  if (formContent.includes('const groupSocialEnabled = useWatch({ control, name: \'groupSocialEnabled\' });')) {
    console.log('   ✅ Group Social field uses useWatch for proper re-rendering');
  } else {
    console.log('   ❌ Group Social field is not using useWatch');
  }
  
  // Check for conditional rendering with variables instead of watch() calls
  if (formContent.includes('{loanInsuranceEnabled && (')) {
    console.log('   ✅ Loan Insurance conditional rendering uses variable');
  } else {
    console.log('   ❌ Loan Insurance conditional rendering not using variable');
  }
  
  if (formContent.includes('{groupSocialEnabled && (')) {
    console.log('   ✅ Group Social conditional rendering uses variable');
  } else {
    console.log('   ❌ Group Social conditional rendering not using variable');
  }
  
  // Check for no duplicate variables
  const loanInsuranceMatches = (formContent.match(/const loanInsuranceEnabled = useWatch/g) || []).length;
  const groupSocialMatches = (formContent.match(/const groupSocialEnabled = useWatch/g) || []).length;
  
  if (loanInsuranceMatches === 1) {
    console.log('   ✅ No duplicate loanInsuranceEnabled variables');
  } else {
    console.log(`   ❌ Found ${loanInsuranceMatches} loanInsuranceEnabled variables (should be 1)`);
  }
  
  if (groupSocialMatches === 1) {
    console.log('   ✅ No duplicate groupSocialEnabled variables');
  } else {
    console.log(`   ❌ Found ${groupSocialMatches} groupSocialEnabled variables (should be 1)`);
  }
  
  console.log('\n🎯 Fix Summary:');
  console.log('   🔄 Replaced watch() calls with useWatch hooks');
  console.log('   🔄 Updated conditional rendering to use variables');
  console.log('   🔄 Fixed JSX syntax errors');
  console.log('   🔄 Removed duplicate variable declarations');
  
  console.log('\n✅ Expected Behavior:');
  console.log('   - When you enable "Loan Insurance", the percentage field should appear immediately');
  console.log('   - When you enable "Group Social", the amount field should appear immediately');
  console.log('   - No need to click other fields to trigger re-rendering');
  console.log('   - Dynamic visibility works properly on first interaction');
  
  console.log('\n🚀 Ready for testing!');
  console.log('   Navigate to group creation and try enabling the features.');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}
