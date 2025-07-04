const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDirectData() {
  try {
    console.log('🧪 TESTING DIRECT DATABASE QUERY VS GROUP API LOGIC\n');

    const groupId = '684bae097517c05bab9a2eac';
    const memberId = '684baddb7517c05bab9a2e9d'; // Alice Johnson
    
    // Get the group with memberships (same query as Group API)
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
      console.log('❌ Group not found');
      return;
    }

    const membership = group.memberships.find(m => m.member.id === memberId);
    if (!membership) {
      console.log('❌ Member not found');
      return;
    }

    // Apply the NEW logic (like the fixed Group API)
    const membershipLoanAmount = membership.currentLoanAmount || membership.member.currentLoanAmount || 0;
    const activeLoanBalance = membership.member.loans?.reduce((total, loan) => total + loan.currentBalance, 0) || 0;
    
    // OLD calculation (what was causing the issue)
    const oldCurrentLoanBalance = membershipLoanAmount + activeLoanBalance;
    
    // NEW calculation (fixed version)
    const newCurrentLoanBalance = activeLoanBalance;

    console.log(`👤 Member: ${membership.member.name}`);
    console.log(`\n💰 Loan Balance Breakdown:`);
    console.log(`  📋 Membership loan amount: ₹${membershipLoanAmount}`);
    console.log(`  🔄 Active loan balance: ₹${activeLoanBalance}`);
    
    console.log(`\n🔄 Before Fix (causing error):`);
    console.log(`  currentLoanBalance = membership + active = ₹${oldCurrentLoanBalance}`);
    
    console.log(`\n✅ After Fix (matches repayment API):`);
    console.log(`  currentLoanBalance = active only = ₹${newCurrentLoanBalance}`);

    // Verify with repayment API logic
    const repaymentLoan = await prisma.loan.findFirst({
      where: {
        memberId: memberId,
        groupId: groupId,
        status: 'ACTIVE',
        currentBalance: { gt: 0 }
      }
    });

    const repaymentApiBalance = repaymentLoan ? repaymentLoan.currentBalance : 0;
    
    console.log(`\n🎯 Repayment API Logic:`);
    console.log(`  Looks for active loans with balance > 0: ₹${repaymentApiBalance}`);
    
    console.log(`\n🧪 CONSISTENCY TEST:`);
    console.log(`  New Group API balance: ₹${newCurrentLoanBalance}`);
    console.log(`  Repayment API balance: ₹${repaymentApiBalance}`);
    console.log(`  Match: ${newCurrentLoanBalance === repaymentApiBalance ? '✅ YES' : '❌ NO'}`);
    
    if (newCurrentLoanBalance === repaymentApiBalance) {
      console.log(`\n🎉 SUCCESS! The fix resolves the issue:`);
      console.log(`  • Frontend will show: ₹${newCurrentLoanBalance}`);
      console.log(`  • Backend will accept: ₹${repaymentApiBalance}`);
      console.log(`  • No more "amount exceeds balance" errors!`);
    }

    console.log(`\n📝 SUMMARY:`);
    console.log(`  Before: Frontend showed ₹${oldCurrentLoanBalance}, backend found ₹${repaymentApiBalance}`);
    console.log(`  After:  Frontend shows ₹${newCurrentLoanBalance}, backend finds ₹${repaymentApiBalance}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDirectData();
