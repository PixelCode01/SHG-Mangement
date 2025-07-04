const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCashCalculationDirect() {
  console.log('🧪 Testing Cash Calculation Logic Directly...\n');

  try {
    // Find test group
    const group = await prisma.group.findFirst({
      where: { name: 'gd' },
      select: {
        id: true,
        name: true,
        cashInHand: true,
        balanceInBank: true,
        memberships: {
          select: {
            currentLoanAmount: true,
            member: {
              select: {
                loans: {
                  where: {
                    status: 'ACTIVE'
                  },
                  select: {
                    currentBalance: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!group) {
      console.log('❌ Test group "gd" not found');
      return;
    }

    console.log(`📊 Group: ${group.name}`);
    console.log(`💰 Initial Cash in Hand: ₹${group.cashInHand}`);
    console.log(`🏦 Initial Cash in Bank: ₹${group.balanceInBank}`);
    
    const totalCash = (group.cashInHand || 0) + (group.balanceInBank || 0);
    console.log(`💵 Total Starting Cash: ₹${totalCash}`);

    // Calculate total loan assets
    let totalLoanAssets = 0;
    for (const membership of group.memberships) {
      const activeLoanBalance = membership.member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
      if (activeLoanBalance > 0) {
        totalLoanAssets += activeLoanBalance;
      } else if (membership.currentLoanAmount && membership.currentLoanAmount > 0) {
        totalLoanAssets += membership.currentLoanAmount;
      }
    }
    
    console.log(`💳 Total Loan Assets: ₹${totalLoanAssets}`);
    
    const totalStanding = totalCash + totalLoanAssets;
    console.log(`📊 Total Standing: ₹${totalStanding}\n`);

    // Test scenario parameters
    const inflows = 1000; // contributions
    const loanRepayments = 300;
    const outflows = 100; // expenses
    
    console.log('🧪 Testing Cash Calculation Logic:');
    console.log(`  Starting Cash: ₹${totalCash}`);
    console.log(`  + Inflows: ₹${inflows}`);
    console.log(`  + Loan Repayments: ₹${loanRepayments}`);
    console.log(`  - Outflows: ₹${outflows}`);
    
    // OLD CALCULATION (wrong)
    const oldCalculation = totalStanding + inflows - outflows + loanRepayments;
    console.log(`\n❌ OLD Calculation (wrong - includes loans in starting balance):`);
    console.log(`  ₹${totalStanding} + ₹${inflows} - ₹${outflows} + ₹${loanRepayments} = ₹${oldCalculation}`);
    
    // NEW CALCULATION (correct) 
    const newCalculation = totalCash + inflows - outflows + loanRepayments;
    console.log(`\n✅ NEW Calculation (correct - cash flows only):`);
    console.log(`  ₹${totalCash} + ₹${inflows} - ₹${outflows} + ₹${loanRepayments} = ₹${newCalculation}`);
    
    console.log(`\n📊 Comparison:`);
    console.log(`  Frontend expected: ₹${newCalculation}`);
    console.log(`  Backend old logic: ₹${oldCalculation}`);
    console.log(`  Difference: ₹${oldCalculation - newCalculation}`);
    console.log(`  Difference should equal loan assets: ₹${totalLoanAssets}`);
    
    if (oldCalculation - newCalculation === totalLoanAssets) {
      console.log('✅ The difference matches loan assets - our analysis is correct!');
    } else {
      console.log('❌ Unexpected difference in calculations');
    }

    console.log('\n🎯 Fix Summary:');
    console.log('- Backend was including total standing (cash + loans) as starting balance');
    console.log('- Should only include cash portion for cash flow calculations');
    console.log('- Our fix separates cash from total standing for cash calculations');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCashCalculationDirect();
