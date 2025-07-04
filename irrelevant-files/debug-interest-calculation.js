const { PrismaClient } = require('@prisma/client');

// Function to calculate period interest from decimal 
function calculatePeriodInterestFromDecimal(loanBalance, annualInterestRate, collectionFrequency) {
  if (loanBalance <= 0 || annualInterestRate <= 0) return 0;
  
  let periodsPerYear;
  switch (collectionFrequency) {
    case 'WEEKLY':
      periodsPerYear = 52;
      break;
    case 'FORTNIGHTLY':
      periodsPerYear = 26;
      break;
    case 'MONTHLY':
      periodsPerYear = 12;
      break;
    case 'YEARLY':
      periodsPerYear = 1;
      break;
    default:
      periodsPerYear = 12; // Default to monthly
  }
  
  const periodInterestRate = annualInterestRate / periodsPerYear;
  return loanBalance * periodInterestRate;
}

function roundToTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

async function debugInterestCalculation() {
  console.log('=== DEBUGGING INTEREST CALCULATION ===');
  const prisma = new PrismaClient();
  
  try {
    const groupId = '6847e1af178e279a3c1f546a';
    
    // Get group with memberships
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        lateFineRules: true,
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!group) {
      console.log('Group not found');
      return;
    }

    console.log(`\nGroup: ${group.name}`);
    console.log(`Monthly Contribution: ₹${group.monthlyContribution || 0}`);
    console.log(`Interest Rate: ${group.interestRate || 0}%`);
    console.log(`Collection Frequency: ${group.collectionFrequency}`);
    console.log(`Members: ${group.memberships.length}`);

    // Get loans for all members
    console.log(`\n=== MEMBER LOAN DETAILS ===`);
    let totalFrontendExpected = 0;
    let totalExpectedContributions = 0;
    let totalExpectedInterest = 0;
    let totalLateFines = 0;
    
    const expectedContribution = group.monthlyContribution || 0;
    const interestRate = (group.interestRate || 0) / 100;

    for (const membership of group.memberships) {
      const member = membership.member;
      
      // Get current loan balance for this member
      const loans = await prisma.loan.findMany({
        where: { 
          memberId: member.id
        }
      });

      let currentLoanBalance = 0;
      if (loans.length > 0) {
        currentLoanBalance = loans.reduce((sum, loan) => sum + (loan.currentAmount || 0), 0);
      }

      // Calculate expected interest (frontend style)
      const expectedInterest = roundToTwoDecimals(calculatePeriodInterestFromDecimal(
        currentLoanBalance,
        interestRate,
        group.collectionFrequency || 'MONTHLY'
      ));

      // Late fine calculation (should be 0 based on our previous test)
      const lateFineAmount = 0; // We already confirmed this is 0

      const memberTotalExpected = roundToTwoDecimals(expectedContribution + expectedInterest + lateFineAmount);

      console.log(`${member.name}: Loan=₹${currentLoanBalance}, Interest=₹${expectedInterest}, Total=₹${memberTotalExpected}`);

      totalExpectedContributions += expectedContribution;
      totalExpectedInterest += expectedInterest;
      totalLateFines += lateFineAmount;
      totalFrontendExpected += memberTotalExpected;
    }

    console.log(`\n=== FRONTEND TOTALS ===`);
    console.log(`Total Expected Contributions: ₹${totalExpectedContributions.toFixed(2)}`);
    console.log(`Total Expected Interest: ₹${totalExpectedInterest.toFixed(2)}`);
    console.log(`Total Late Fines: ₹${totalLateFines.toFixed(2)}`);
    console.log(`Total Frontend Expected: ₹${totalFrontendExpected.toFixed(2)}`);

    console.log(`\n=== COMPARISON ===`);
    console.log(`Frontend Total: ₹${totalFrontendExpected.toFixed(2)}`);
    console.log(`User Reported: ₹8,394.92`);
    console.log(`Backend (from debug): ₹7,650.00`);
    console.log(`Difference (Frontend - User): ₹${(totalFrontendExpected - 8394.92).toFixed(2)}`);
    console.log(`Difference (User - Backend): ₹${(8394.92 - 7650.00).toFixed(2)}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugInterestCalculation().then(() => {
  console.log('Debug completed');
}).catch(err => {
  console.error('Debug error:', err);
});
