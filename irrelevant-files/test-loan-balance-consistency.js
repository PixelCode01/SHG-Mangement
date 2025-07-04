const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testLoanBalanceConsistency() {
  try {
    console.log('🧪 TESTING LOAN BALANCE CONSISTENCY FIX\n');

    // Get the test data
    const groupId = '684bae097517c05bab9a2eac';
    const memberId = '684baddb7517c05bab9a2e9d'; // Alice Johnson
    
    console.log('📊 Step 1: Check database state directly');
    
    // Check membership loan amount
    const membership = await prisma.memberGroupMembership.findFirst({
      where: { 
        memberId: memberId,
        groupId: groupId 
      },
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
    });

    if (!membership) {
      console.log('❌ Membership not found');
      return;
    }

    const membershipLoanAmount = membership.currentLoanAmount || membership.member.currentLoanAmount || 0;
    const activeLoanBalance = membership.member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
    
    console.log(`  Member: ${membership.member.name}`);
    console.log(`  Membership loan amount: ₹${membershipLoanAmount}`);
    console.log(`  Active loan balance: ₹${activeLoanBalance}`);
    console.log(`  Combined total: ₹${membershipLoanAmount + activeLoanBalance}`);

    // Test Group API response
    console.log('\n📊 Step 2: Test Group API response');
    const response = await fetch(`http://localhost:3000/api/groups/${groupId}`);
    
    if (!response.ok) {
      console.log(`❌ Group API failed: ${response.status}`);
      return;
    }

    const groupData = await response.json();
    const member = groupData.members.find(m => m.id === memberId);
    
    if (!member) {
      console.log('❌ Member not found in Group API response');
      return;
    }

    console.log(`  API currentLoanBalance: ₹${member.currentLoanBalance}`);
    console.log(`  API currentLoanAmount: ₹${member.currentLoanAmount}`);

    // Test loan repayment API logic
    console.log('\n📊 Step 3: Test loan repayment API logic');
    const loan = await prisma.loan.findFirst({
      where: {
        memberId: memberId,
        groupId: groupId,
        status: 'ACTIVE',
        currentBalance: { gt: 0 }
      }
    });

    const repaymentApiBalance = loan ? loan.currentBalance : 0;
    console.log(`  Repayment API sees: ₹${repaymentApiBalance}`);

    // Verify consistency
    console.log('\n🎯 CONSISTENCY CHECK:');
    const isConsistent = member.currentLoanBalance === repaymentApiBalance;
    console.log(`  Group API currentLoanBalance: ₹${member.currentLoanBalance}`);
    console.log(`  Repayment API balance: ₹${repaymentApiBalance}`);
    console.log(`  Consistent: ${isConsistent ? '✅ YES' : '❌ NO'}`);

    if (isConsistent) {
      console.log('\n🎉 SUCCESS: Loan balance consistency has been fixed!');
      console.log('   Frontend will now display the same balance that can be repaid.');
    } else {
      console.log('\n❌ ISSUE: Values still don\'t match');
      console.log('   Need to investigate further...');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLoanBalanceConsistency();
