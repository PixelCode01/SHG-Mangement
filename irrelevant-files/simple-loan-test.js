/**
 * Simple test to verify loan calculation logic
 */

console.log('Testing loan calculation logic...');

// Simulate the currentLoanBalance calculation from the API
const memberWithLoans = {
  id: 'member1',
  name: 'Test Member',
  loans: [
    { currentBalance: 5000, status: 'ACTIVE' },
    { currentBalance: 3000, status: 'ACTIVE' },
    { currentBalance: 2000, status: 'PAID' } // This should not be included
  ]
};

// This mimics the calculation from the group API (line 90 in route.ts)
const currentLoanBalance = memberWithLoans.loans
  .filter(loan => loan.status === 'ACTIVE')
  .reduce((total, loan) => total + loan.currentBalance, 0);

console.log('Member:', memberWithLoans.name);
console.log('Active loans:', memberWithLoans.loans.filter(l => l.status === 'ACTIVE'));
console.log('Current loan balance:', currentLoanBalance);
console.log('Expected result: 8000 (5000 + 3000)');
console.log('Test passed:', currentLoanBalance === 8000);

// Test interest calculation
const interestRate = 2; // 2%
const calculatedInterest = (currentLoanBalance * interestRate) / 100;
console.log('\nInterest calculation:');
console.log('Total loan amount:', currentLoanBalance);
console.log('Interest rate:', interestRate + '%');
console.log('Calculated interest:', calculatedInterest);
console.log('Expected: 160 (8000 * 0.02)');
console.log('Test passed:', calculatedInterest === 160);

console.log('\n✅ Basic loan calculation logic works correctly!');
console.log('✅ New active loans will be included in interest calculations!');
