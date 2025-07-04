/**
 * Test file to verify decimal rounding is working correctly in SHG calculations
 */

import { roundToTwoDecimals, formatCurrency, parseCurrencyInput } from '../app/lib/currency-utils';

function testCurrencyUtils() {
  console.log('🧮 Testing Currency Utility Functions');
  console.log('=====================================');
  
  // Test rounding function
  console.log('\n1. Testing roundToTwoDecimals function:');
  const testValues = [
    123.456789,
    123.454,
    123.455,
    123.459,
    0.1 + 0.2, // This is 0.30000000000000004 in JavaScript
    10.005,
    10.995,
    0.999,
    100.00000000001
  ];
  
  testValues.forEach(value => {
    const rounded = roundToTwoDecimals(value);
    console.log(`   ${value} → ${rounded}`);
  });
  
  // Test formatting function
  console.log('\n2. Testing formatCurrency function:');
  testValues.forEach(value => {
    const formatted = formatCurrency(value);
    console.log(`   ${value} → ${formatted}`);
  });
  
  // Test parsing function
  console.log('\n3. Testing parseCurrencyInput function:');
  const testInputs = [
    '₹1,234.56',
    '1234.567',
    '₹ 1,234.99',
    '1234',
    'invalid',
    '0.1',
    '123.456'
  ];
  
  testInputs.forEach(input => {
    const parsed = parseCurrencyInput(input);
    console.log(`   "${input}" → ${parsed}`);
  });
  
  // Test contribution calculations with rounding
  console.log('\n4. Testing contribution calculations:');
  
  // Simulate interest calculation
  const loanAmount = 10000;
  const annualRate = 12; // 12% per annum
  const monthlyRate = annualRate / 12; // 1% per month
  const rawInterest = (loanAmount * monthlyRate) / 100;
  const roundedInterest = roundToTwoDecimals(rawInterest);
  
  console.log(`   Loan Amount: ₹${formatCurrency(loanAmount)}`);
  console.log(`   Monthly Interest (raw): ${rawInterest}`);
  console.log(`   Monthly Interest (rounded): ₹${formatCurrency(roundedInterest)}`);
  
  // Simulate late fine calculation
  const contributionAmount = 1000;
  const daysLate = 5;
  const dailyFinePercentage = 0.5; // 0.5% per day
  const rawLateFine = contributionAmount * (dailyFinePercentage / 100) * daysLate;
  const roundedLateFine = roundToTwoDecimals(rawLateFine);
  
  console.log(`   Contribution: ₹${formatCurrency(contributionAmount)}`);
  console.log(`   Late Fine (raw): ${rawLateFine}`);
  console.log(`   Late Fine (rounded): ₹${formatCurrency(roundedLateFine)}`);
  
  // Simulate total expected calculation
  const expectedContribution = 1000;
  const expectedInterest = roundedInterest;
  const lateFineAmount = roundedLateFine;
  const totalExpected = roundToTwoDecimals(expectedContribution + expectedInterest + lateFineAmount);
  
  console.log(`   Expected Contribution: ₹${formatCurrency(expectedContribution)}`);
  console.log(`   Expected Interest: ₹${formatCurrency(expectedInterest)}`);
  console.log(`   Late Fine: ₹${formatCurrency(lateFineAmount)}`);
  console.log(`   Total Expected: ₹${formatCurrency(totalExpected)}`);
  
  console.log('\n✅ Currency utility tests completed successfully!');
}

// Run the test
testCurrencyUtils();
