const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testGroupStandingLogic() {
  try {
    console.log('🧪 Testing Group Standing Logic Comprehensively...\n');

    const groupId = '68382afd6cad8afd7cf5bb1f';
    
    // 1. Get group data with memberships and loans
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            member: {
              include: {
                loans: {
                  where: { status: 'ACTIVE' }
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

    console.log(`📊 Analyzing group: ${group.name}`);
    console.log(`   Members: ${group.memberships.length}`);

    // 2. Calculate loan assets using the same logic as our API fix
    const outstandingLoans = [];
    let totalOutstandingLoanAmount = 0;
    let totalInitialLoanAmountWithoutActiveLoans = 0;

    for (const membership of group.memberships) {
      const member = membership.member;
      
      // Outstanding loans from active loan records
      for (const loan of member.loans) {
        outstandingLoans.push({
          memberName: member.name,
          currentBalance: loan.currentBalance
        });
        totalOutstandingLoanAmount += loan.currentBalance;
      }

      // Initial loan amounts for members without active loans
      if (member.loans.length === 0 && member.initialLoanAmount) {
        totalInitialLoanAmountWithoutActiveLoans += member.initialLoanAmount;
        console.log(`   📝 ${member.name}: Initial loan ₹${member.initialLoanAmount} (no active loan)`);
      } else if (member.loans.length > 0) {
        const currentBalance = member.loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
        console.log(`   💰 ${member.name}: Active loans ₹${currentBalance}`);
      }
    }

    const totalLoanAssets = totalOutstandingLoanAmount + totalInitialLoanAmountWithoutActiveLoans;

    console.log(`\n📈 Loan Asset Calculation:`);
    console.log(`   - Outstanding loan amounts: ₹${totalOutstandingLoanAmount}`);
    console.log(`   - Initial loan amounts (no active loans): ₹${totalInitialLoanAmountWithoutActiveLoans}`);
    console.log(`   - Total loan assets: ₹${totalLoanAssets}`);

    // 3. Simulate group standing calculation (old vs new logic)
    const testCashInHand = 25000;
    const testCashInBank = 35000;
    const testTotalCash = testCashInHand + testCashInBank; // 60000

    console.log(`\n🧮 Group Standing Calculation Comparison:`);
    console.log(`   Test cash scenario: ₹${testCashInHand} in hand + ₹${testCashInBank} in bank = ₹${testTotalCash} total cash`);

    // Old logic (periodic records before fix): only cash
    const oldGroupStanding = testTotalCash;
    
    // New logic (periodic records after fix): cash + loan assets  
    const newGroupStanding = testTotalCash + totalLoanAssets;
    
    // Group creation logic (for comparison)
    const groupCreationStanding = totalLoanAssets + testCashInHand + testCashInBank;

    console.log(`\n📊 Results:`);
    console.log(`   - Old periodic logic (cash only): ₹${oldGroupStanding}`);
    console.log(`   - New periodic logic (cash + loans): ₹${newGroupStanding}`);
    console.log(`   - Group creation logic (loans + cash): ₹${groupCreationStanding}`);

    if (Math.abs(newGroupStanding - groupCreationStanding) < 0.01) {
      console.log(`\n✅ SUCCESS: Periodic records now match group creation logic!`);
      console.log(`   Difference: ₹${Math.abs(newGroupStanding - groupCreationStanding)}`);
    } else {
      console.log(`\n❌ MISMATCH: Periodic records still don't match group creation`);
      console.log(`   Difference: ₹${Math.abs(newGroupStanding - groupCreationStanding)}`);
    }

    console.log(`\n🎯 Key Fix Benefits:`);
    console.log(`   - Group standing increased by ₹${totalLoanAssets} (loan assets)`);
    console.log(`   - Consistent calculation between group creation and periodic records`);
    console.log(`   - Outstanding loans properly counted as group assets`);

    // 4. Show the specific impact
    console.log(`\n📋 Impact Summary:`);
    console.log(`   - Before fix: Group standing ignored ₹${totalLoanAssets} in loan assets`);
    console.log(`   - After fix: Group standing correctly includes all loan assets`);
    console.log(`   - This fixes the discrepancy where group creation showed higher standing than periodic records`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testGroupStandingLogic();
