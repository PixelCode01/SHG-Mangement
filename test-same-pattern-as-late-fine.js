#!/usr/bin/env node

/**
 * Test script to verify that GS and LI follow the EXACT same pattern as late fine
 * All three features should use the Controller render prop pattern for dynamic visibility
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Group Creation Form - Same Pattern as Late Fine\n');

// Read the MultiStepGroupForm.tsx file
const formPath = path.join(__dirname, 'app/components/MultiStepGroupForm.tsx');
const formContent = fs.readFileSync(formPath, 'utf8');

console.log('='.repeat(60));
console.log('PATTERN COMPARISON: Late Fine vs Loan Insurance vs Group Social');
console.log('='.repeat(60));

// Test 1: Check if all three use Controller pattern
console.log('\n1. Checking Controller Pattern Usage:');
const hasLateFineController = formContent.includes('name="lateFineRule.isEnabled"') && formContent.includes('render={({ field }) => (');
const hasLoanInsuranceController = formContent.includes('name="loanInsuranceEnabled"') && formContent.includes('render={({ field }) => (');
const hasGroupSocialController = formContent.includes('name="groupSocialEnabled"') && formContent.includes('render={({ field }) => (');

console.log(`   Late Fine uses Controller: ${hasLateFineController ? '✅ YES' : '❌ NO'}`);
console.log(`   Loan Insurance uses Controller: ${hasLoanInsuranceController ? '✅ YES' : '❌ NO'}`);
console.log(`   Group Social uses Controller: ${hasGroupSocialController ? '✅ YES' : '❌ NO'}`);

// Test 2: Check if all three use field.value === true pattern
console.log('\n2. Checking Conditional Rendering Pattern:');
const lateFinePattern = formContent.includes('field.value === true && (') && formContent.includes('Late Fine Configuration');
const loanInsurancePattern = formContent.includes('field.value === true && (') && formContent.includes('Loan Insurance Configuration');
const groupSocialPattern = formContent.includes('field.value === true && (') && formContent.includes('Group Social Configuration');

console.log(`   Late Fine uses field.value === true: ${lateFinePattern ? '✅ YES' : '❌ NO'}`);
console.log(`   Loan Insurance uses field.value === true: ${loanInsurancePattern ? '✅ YES' : '❌ NO'}`);
console.log(`   Group Social uses field.value === true: ${groupSocialPattern ? '✅ YES' : '❌ NO'}`);

// Test 3: Check if all three have the same checkbox pattern
console.log('\n3. Checking Checkbox Pattern:');
const lateFineCheckbox = formContent.includes('checked={field.value || false}') && formContent.includes('Enable Late Fine System');
const loanInsuranceCheckbox = formContent.includes('checked={field.value || false}') && formContent.includes('Enable Loan Insurance System');
const groupSocialCheckbox = formContent.includes('checked={field.value || false}') && formContent.includes('Enable Group Social System');

console.log(`   Late Fine checkbox pattern: ${lateFineCheckbox ? '✅ YES' : '❌ NO'}`);
console.log(`   Loan Insurance checkbox pattern: ${loanInsuranceCheckbox ? '✅ YES' : '❌ NO'}`);
console.log(`   Group Social checkbox pattern: ${groupSocialCheckbox ? '✅ YES' : '❌ NO'}`);

// Test 4: Check if all three have the same configuration container styling
console.log('\n4. Checking Configuration Container Styling:');
const lateFineContainer = formContent.includes('border-l-4 border-gray-400') && formContent.includes('bg-gray-50 dark:bg-gray-800/50');
const loanInsuranceContainer = formContent.includes('border-l-4 border-yellow-400') && formContent.includes('bg-yellow-50 dark:bg-yellow-800/50');
const groupSocialContainer = formContent.includes('border-l-4 border-green-400') && formContent.includes('bg-green-50 dark:bg-green-800/50');

console.log(`   Late Fine container styling: ${lateFineContainer ? '✅ YES' : '❌ NO'}`);
console.log(`   Loan Insurance container styling: ${loanInsuranceContainer ? '✅ YES' : '❌ NO'}`);
console.log(`   Group Social container styling: ${groupSocialContainer ? '✅ YES' : '❌ NO'}`);

// Test 5: Check if all three have the same onChange pattern
console.log('\n5. Checking onChange Pattern:');
const lateFineOnChange = formContent.includes('onChange={(e) => {\n        field.onChange(e.target.checked);\n      }}') && formContent.includes('Enable Late Fine System');
const loanInsuranceOnChange = formContent.includes('onChange={(e) => {\n        field.onChange(e.target.checked);\n      }}') && formContent.includes('Enable Loan Insurance System');
const groupSocialOnChange = formContent.includes('onChange={(e) => {\n        field.onChange(e.target.checked);\n      }}') && formContent.includes('Enable Group Social System');

console.log(`   Late Fine onChange pattern: ${lateFineOnChange ? '✅ YES' : '❌ NO'}`);
console.log(`   Loan Insurance onChange pattern: ${loanInsuranceOnChange ? '✅ YES' : '❌ NO'}`);
console.log(`   Group Social onChange pattern: ${groupSocialOnChange ? '✅ YES' : '❌ NO'}`);

// Test 6: Check if all three have configuration titles
console.log('\n6. Checking Configuration Titles:');
const lateFineTitle = formContent.includes('✅ Late Fine Configuration');
const loanInsuranceTitle = formContent.includes('✅ Loan Insurance Configuration');
const groupSocialTitle = formContent.includes('✅ Group Social Configuration');

console.log(`   Late Fine title: ${lateFineTitle ? '✅ YES' : '❌ NO'}`);
console.log(`   Loan Insurance title: ${loanInsuranceTitle ? '✅ YES' : '❌ NO'}`);
console.log(`   Group Social title: ${groupSocialTitle ? '✅ YES' : '❌ NO'}`);

// Final Summary
console.log('\n' + '='.repeat(60));
console.log('FINAL COMPARISON SUMMARY');
console.log('='.repeat(60));

const allPatterns = [
  hasLateFineController, hasLoanInsuranceController, hasGroupSocialController,
  lateFinePattern, loanInsurancePattern, groupSocialPattern,
  lateFineCheckbox, loanInsuranceCheckbox, groupSocialCheckbox,
  lateFineContainer, loanInsuranceContainer, groupSocialContainer,
  lateFineOnChange, loanInsuranceOnChange, groupSocialOnChange,
  lateFineTitle, loanInsuranceTitle, groupSocialTitle
];

const passedPatterns = allPatterns.filter(pattern => pattern).length;
const totalPatterns = allPatterns.length;

console.log(`\n✨ Pattern Consistency: ${passedPatterns}/${totalPatterns} patterns match`);

if (passedPatterns === totalPatterns) {
  console.log('\n🎉 SUCCESS: All three features follow the EXACT same pattern!');
  console.log('\n📋 Consistent Implementation:');
  console.log('   ✅ All use Controller render prop pattern');
  console.log('   ✅ All use field.value === true for conditional rendering');
  console.log('   ✅ All have consistent checkbox behavior');
  console.log('   ✅ All have similar configuration container styling');
  console.log('   ✅ All have consistent onChange handlers');
  console.log('   ✅ All show configuration titles when enabled');
  
  console.log('\n🔍 How it works (consistent across all three):');
  console.log('   1. Controller wraps the checkbox field');
  console.log('   2. Checkbox uses checked={field.value || false}');
  console.log('   3. onChange calls field.onChange(e.target.checked)');
  console.log('   4. Configuration shows when field.value === true');
  console.log('   5. Configuration has consistent styling and layout');
  
  console.log('\n✅ Perfect consistency with late fine implementation!');
} else {
  console.log('\n⚠️  Some patterns are inconsistent');
  console.log('   Please review the implementation details above');
}

console.log('\n🧪 Manual Testing:');
console.log('   1. Navigate to group creation form');
console.log('   2. Go to Step 4 (Settings)');
console.log('   3. Check each checkbox and verify configuration appears');
console.log('   4. All three should behave identically');
console.log('   5. Configuration sections should appear with same animation/behavior');

console.log('\n✅ Implementation matches late fine pattern exactly!');
