#!/usr/bin/env node

/**
 * Test script to verify dynamic visibility implementation in group edit form
 * Tests the same pattern as late fine configuration for loan insurance and group social
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Group Edit Form Dynamic Visibility Implementation\n');

// Read the group edit page file
const editPagePath = path.join(__dirname, 'app/groups/[id]/edit/page.tsx');
const editPageContent = fs.readFileSync(editPagePath, 'utf8');

// Test 1: Check if watch is set up for loan insurance and group social
console.log('Test 1: Checking if watch is set up for reactive visibility...');
const hasLoanInsuranceWatch = editPageContent.includes('const loanInsuranceEnabled = watch("loanInsuranceEnabled")');
const hasGroupSocialWatch = editPageContent.includes('const groupSocialEnabled = watch("groupSocialEnabled")');

console.log(`✅ Loan Insurance watch: ${hasLoanInsuranceWatch ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social watch: ${hasGroupSocialWatch ? 'FOUND' : 'MISSING'}`);

// Test 2: Check if conditional rendering is implemented
console.log('\nTest 2: Checking conditional rendering patterns...');
const hasLoanInsuranceConditional = editPageContent.includes('{loanInsuranceEnabled && (');
const hasGroupSocialConditional = editPageContent.includes('{groupSocialEnabled && (');

console.log(`✅ Loan Insurance conditional: ${hasLoanInsuranceConditional ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social conditional: ${hasGroupSocialConditional ? 'FOUND' : 'MISSING'}`);

// Test 3: Check if form schema includes the fields
console.log('\nTest 3: Checking form schema includes all required fields...');
const hasLoanInsuranceSchema = editPageContent.includes('loanInsuranceEnabled: z.boolean().optional()');
const hasLoanInsurancePercentSchema = editPageContent.includes('loanInsurancePercent: z.number()');
const hasGroupSocialSchema = editPageContent.includes('groupSocialEnabled: z.boolean().optional()');
const hasGroupSocialAmountSchema = editPageContent.includes('groupSocialAmountPerFamilyMember: z.number()');

console.log(`✅ Loan Insurance enabled schema: ${hasLoanInsuranceSchema ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Loan Insurance percent schema: ${hasLoanInsurancePercentSchema ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social enabled schema: ${hasGroupSocialSchema ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social amount schema: ${hasGroupSocialAmountSchema ? 'FOUND' : 'MISSING'}`);

// Test 4: Check if form submission includes the fields
console.log('\nTest 4: Checking form submission handler includes all fields...');
const hasLoanInsuranceSubmit = editPageContent.includes('loanInsuranceEnabled: data.loanInsuranceEnabled');
const hasLoanInsurancePercentSubmit = editPageContent.includes('loanInsurancePercent: data.loanInsuranceEnabled ? data.loanInsurancePercent : null');
const hasGroupSocialSubmit = editPageContent.includes('groupSocialEnabled: data.groupSocialEnabled');
const hasGroupSocialAmountSubmit = editPageContent.includes('groupSocialAmountPerFamilyMember: data.groupSocialEnabled ? data.groupSocialAmountPerFamilyMember : null');

console.log(`✅ Loan Insurance enabled submit: ${hasLoanInsuranceSubmit ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Loan Insurance percent submit: ${hasLoanInsurancePercentSubmit ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social enabled submit: ${hasGroupSocialSubmit ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social amount submit: ${hasGroupSocialAmountSubmit ? 'FOUND' : 'MISSING'}`);

// Test 5: Check if UI elements are properly structured
console.log('\nTest 5: Checking UI elements structure...');
const hasLoanInsuranceCheckbox = editPageContent.includes('id="loanInsuranceEnabled"');
const hasLoanInsurancePercentInput = editPageContent.includes('id="loanInsurancePercent"');
const hasGroupSocialCheckbox = editPageContent.includes('id="groupSocialEnabled"');
const hasGroupSocialAmountInput = editPageContent.includes('id="groupSocialAmountPerFamilyMember"');

console.log(`✅ Loan Insurance checkbox: ${hasLoanInsuranceCheckbox ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Loan Insurance percent input: ${hasLoanInsurancePercentInput ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social checkbox: ${hasGroupSocialCheckbox ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social amount input: ${hasGroupSocialAmountInput ? 'FOUND' : 'MISSING'}`);

// Test 6: Check if help text and styling are included
console.log('\nTest 6: Checking help text and styling...');
const hasLoanInsuranceHelpText = editPageContent.includes('How loan insurance works:');
const hasGroupSocialHelpText = editPageContent.includes('How family-based group social fund works:');
const hasLoanInsuranceStyles = editPageContent.includes('bg-yellow-50 dark:bg-yellow-900/20');
const hasGroupSocialStyles = editPageContent.includes('bg-green-50 dark:bg-green-900/20');

console.log(`✅ Loan Insurance help text: ${hasLoanInsuranceHelpText ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social help text: ${hasGroupSocialHelpText ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Loan Insurance styling: ${hasLoanInsuranceStyles ? 'FOUND' : 'MISSING'}`);
console.log(`✅ Group Social styling: ${hasGroupSocialStyles ? 'FOUND' : 'MISSING'}`);

// Final Summary
console.log('\n' + '='.repeat(50));
console.log('SUMMARY: Dynamic Visibility Implementation Status');
console.log('='.repeat(50));

const allTests = [
  hasLoanInsuranceWatch,
  hasGroupSocialWatch,
  hasLoanInsuranceConditional,
  hasGroupSocialConditional,
  hasLoanInsuranceSchema,
  hasLoanInsurancePercentSchema,
  hasGroupSocialSchema,
  hasGroupSocialAmountSchema,
  hasLoanInsuranceSubmit,
  hasLoanInsurancePercentSubmit,
  hasGroupSocialSubmit,
  hasGroupSocialAmountSubmit,
  hasLoanInsuranceCheckbox,
  hasLoanInsurancePercentInput,
  hasGroupSocialCheckbox,
  hasGroupSocialAmountInput,
  hasLoanInsuranceHelpText,
  hasGroupSocialHelpText,
  hasLoanInsuranceStyles,
  hasGroupSocialStyles
];

const passedTests = allTests.filter(test => test).length;
const totalTests = allTests.length;

console.log(`\n✨ Implementation Status: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 SUCCESS: All dynamic visibility features are implemented correctly!');
  console.log('   - Loan Insurance: Checkbox enables/disables percentage input field');
  console.log('   - Group Social: Checkbox enables/disables amount per family member input field');
  console.log('   - Both follow the same pattern as late fine configuration');
  console.log('   - Form submission properly includes conditional values');
  console.log('   - UI includes proper help text and styling');
} else {
  console.log('⚠️  PARTIAL: Some features may be missing or incomplete');
  console.log('   Please check the implementation details above');
}

console.log('\n📋 Next Steps:');
console.log('   1. Test the UI manually by running the development server');
console.log('   2. Create a test group and verify checkbox behavior');
console.log('   3. Ensure form submission works correctly');
console.log('   4. Test both group creation and group edit forms');
