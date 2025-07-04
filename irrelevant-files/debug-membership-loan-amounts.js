const { PrismaClient } = require('@prisma/client');

async function debugMembershipLoanAmounts() {
  console.log('=== DEBUGGING MEMBERSHIP LOAN AMOUNTS ===');
  const prisma = new PrismaClient();
  
  try {
    const groupId = '6847e1af178e279a3c1f546a';
    
    // Get group with memberships and their loan amounts
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: {
                    groupId: groupId,
                    status: 'ACTIVE'
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('Group not found');
      return;
    }

    console.log(`\nGroup: ${group.name}`);
    console.log(`Members: ${group.memberships.length}`);

    console.log(`\n=== MEMBER LOAN AMOUNT DETAILS ===`);
    let totalInitialLoanAmounts = 0;
    let totalActiveLoanBalances = 0;
    let totalCurrentLoanBalance = 0;

    for (const membership of group.memberships) {
      const member = membership.member;
      
      // Get values exactly like the API does
      const currentLoanAmount = membership.currentLoanAmount || membership.member.currentLoanAmount || 0;
      const activeLoanBalance = member.loans?.reduce((total, loan) => total + loan.currentBalance, 0) || 0;
      const combinedCurrentLoanBalance = currentLoanAmount + activeLoanBalance;

      console.log(`${member.name}:`);
      console.log(`  - membership.currentLoanAmount: ₹${membership.currentLoanAmount || 0}`);
      console.log(`  - member.currentLoanAmount: ₹${membership.member.currentLoanAmount || 0}`);
      console.log(`  - Active loans balance: ₹${activeLoanBalance}`);
      console.log(`  - Combined currentLoanBalance: ₹${combinedCurrentLoanBalance}`);

      totalInitialLoanAmounts += currentLoanAmount;
      totalActiveLoanBalances += activeLoanBalance;
      totalCurrentLoanBalance += combinedCurrentLoanBalance;
    }

    console.log(`\n=== TOTALS ===`);
    console.log(`Total Initial Loan Amounts: ₹${totalInitialLoanAmounts.toFixed(2)}`);
    console.log(`Total Active Loan Balances: ₹${totalActiveLoanBalances.toFixed(2)}`);
    console.log(`Total Current Loan Balance (API): ₹${totalCurrentLoanBalance.toFixed(2)}`);

    // Calculate expected interest for these loan amounts
    const interestRate = (group.interestRate || 0) / 100;
    const monthlyInterestRate = interestRate / 12; // Assuming monthly collection
    const totalExpectedInterest = totalCurrentLoanBalance * monthlyInterestRate;
    
    console.log(`\n=== INTEREST CALCULATION ===`);
    console.log(`Interest Rate: ${group.interestRate || 0}% per year`);
    console.log(`Monthly Interest Rate: ${(monthlyInterestRate * 100).toFixed(2)}%`);
    console.log(`Total Expected Interest: ₹${totalExpectedInterest.toFixed(2)}`);

    // Calculate total expected contributions
    const expectedContribution = group.monthlyContribution || 0;
    const totalExpectedContributions = expectedContribution * group.memberships.length;
    const frontendTotalExpected = totalExpectedContributions + totalExpectedInterest;

    console.log(`\n=== FRONTEND CALCULATION SIMULATION ===`);
    console.log(`Expected Contribution (${expectedContribution} x ${group.memberships.length}): ₹${totalExpectedContributions.toFixed(2)}`);
    console.log(`Expected Interest: ₹${totalExpectedInterest.toFixed(2)}`);
    console.log(`Late Fines: ₹0.00 (confirmed earlier)`);
    console.log(`Frontend Total Expected: ₹${frontendTotalExpected.toFixed(2)}`);

    console.log(`\n=== COMPARISON ===`);
    console.log(`Frontend Total: ₹${frontendTotalExpected.toFixed(2)}`);
    console.log(`User Reported: ₹8,394.92`);
    console.log(`Backend (our script): ₹7,650.00`);
    console.log(`Difference: ₹${Math.abs(frontendTotalExpected - 8394.92).toFixed(2)}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugMembershipLoanAmounts().then(() => {
  console.log('Debug completed');
}).catch(err => {
  console.error('Debug error:', err);
});
